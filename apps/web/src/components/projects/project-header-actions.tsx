"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Code2,
  FlaskConical,
  FolderOpen,
  Gauge,
  GitBranch,
  Hammer,
  ListChecks,
  LoaderCircle,
  PackageSearch,
  Play,
  Rocket,
  ShieldCheck,
  SquareTerminal,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getProject,
  launchLocalAction,
  type LocalActionName,
  type Project,
  type Repository,
} from "@/lib/api";
import {
  projectCommandActions,
  projectOpenActions,
  type ProjectLocalActionOption,
} from "@/lib/project-local-actions";
import { cn } from "@/lib/utils";

const actionIcons: Record<LocalActionName, LucideIcon> = {
  editor: Code2,
  terminal: SquareTerminal,
  finder: FolderOpen,
  remote: GitBranch,
  dev: Rocket,
  test: FlaskConical,
  lint: ListChecks,
  build: Hammer,
  coverage: Gauge,
  audit: ShieldCheck,
  outdated: PackageSearch,
};

interface Notice {
  tone: "pending" | "success" | "error";
  message: string;
}

function projectIdFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  if (!match || match[1] === "new") return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function optionLabel(
  repository: Repository,
  option: ProjectLocalActionOption,
): string {
  if (option.action !== "remote") return option.label;
  if (repository.provider === "github") return "Ouvrir sur GitHub";
  if (repository.provider === "gitlab") return "Ouvrir sur GitLab";
  return option.label;
}

function optionDisabled(
  repository: Repository,
  action: LocalActionName,
  pending: string | null,
): boolean {
  if (pending !== null) return true;
  if (action === "remote") return !repository.remoteUrl;
  return repository.state.availability !== "available";
}

export function ProjectHeaderActions({ pathname }: { pathname: string }) {
  const projectId = useMemo(() => projectIdFromPathname(pathname), [pathname]);
  const [loadedProject, setLoadedProject] = useState<{
    projectId: string;
    project: Project | null;
  } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const controller = new AbortController();
    void getProject(projectId, controller.signal, { silentActivity: true })
      .then((result) => setLoadedProject({ projectId, project: result }))
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setLoadedProject({ projectId, project: null });
        setNotice({
          tone: "error",
          message:
            caught instanceof Error
              ? caught.message
              : "Actions du projet indisponibles.",
        });
      });

    return () => controller.abort();
  }, [pathname, projectId]);

  useEffect(() => {
    if (!notice || notice.tone === "pending") return;
    const timer = window.setTimeout(() => setNotice(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (!projectId) return null;

  const project =
    loadedProject?.projectId === projectId ? loadedProject.project : null;
  const loading = loadedProject?.projectId !== projectId;

  async function launch(
    repository: Repository,
    option: ProjectLocalActionOption,
  ) {
    if (!projectId) return;
    const key = `${repository.id}:${option.action}`;
    const label = optionLabel(repository, option);
    setPending(key);
    setNotice({
      tone: "pending",
      message: `${label} · ${repository.name}`,
    });

    try {
      await launchLocalAction(projectId, repository.id, option.action);
      setNotice({
        tone: "success",
        message:
          option.action === "editor" ||
          option.action === "terminal" ||
          option.action === "finder" ||
          option.action === "remote"
            ? `${label} demandé pour ${repository.name}.`
            : `${label} lancé pour ${repository.name}.`,
      });
    } catch (caught) {
      setNotice({
        tone: "error",
        message:
          caught instanceof Error ? caught.message : "Action impossible.",
      });
    } finally {
      setPending(null);
    }
  }

  const repositories = project?.repositories ?? [];

  return (
    <>
      <div className="hidden items-center gap-1.5 sm:flex">
        <ProjectActionMenu
          label="Ouvrir"
          icon={FolderOpen}
          loading={loading}
          pending={pending}
          repositories={repositories}
          options={projectOpenActions}
          onLaunch={launch}
        />
        <ProjectActionMenu
          label="Actions"
          icon={Play}
          loading={loading}
          pending={pending}
          repositories={repositories}
          options={projectCommandActions}
          onLaunch={launch}
        />
      </div>

      {notice ? (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          aria-live="polite"
          className={cn(
            "fixed top-[68px] right-4 z-50 flex max-w-[min(360px,calc(100vw-32px))] items-center gap-2 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg",
            notice.tone === "error" && "border-destructive/40",
          )}
        >
          {notice.tone === "pending" ? (
            <LoaderCircle className="size-3.5 animate-spin text-primary" />
          ) : notice.tone === "success" ? (
            <CheckCircle2 className="size-3.5 text-emerald-500" />
          ) : (
            <CircleAlert className="size-3.5 text-destructive" />
          )}
          <span>{notice.message}</span>
        </div>
      ) : null}
    </>
  );
}

function ProjectActionMenu({
  label,
  icon: TriggerIcon,
  loading,
  pending,
  repositories,
  options,
  onLaunch,
}: {
  label: string;
  icon: LucideIcon;
  loading: boolean;
  pending: string | null;
  repositories: Repository[];
  options: readonly ProjectLocalActionOption[];
  onLaunch: (
    repository: Repository,
    option: ProjectLocalActionOption,
  ) => Promise<void>;
}) {
  const disabled = loading || !repositories.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            className="h-[29px] rounded-[4px] bg-card px-2 text-[11px]"
            disabled={disabled}
            aria-label={
              label === "Ouvrir"
                ? "Ouvrir les outils du projet"
                : "Exécuter une action du projet"
            }
          />
        }
      >
        {loading ? <LoaderCircle className="animate-spin" /> : <TriggerIcon />}
        <span>{label}</span>
        <ChevronDown className="ml-0.5 size-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {repositories.map((repository, repositoryIndex) => (
          <Fragment key={repository.id}>
            {repositoryIndex ? <DropdownMenuSeparator /> : null}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">
                  {repository.name}
                </span>
                {repository.state.availability !== "available" ? (
                  <span className="font-normal tracking-normal normal-case">
                    Local indisponible
                  </span>
                ) : null}
              </DropdownMenuLabel>
              {options.map((option) => {
                const Icon = actionIcons[option.action];
                const itemPending =
                  pending === `${repository.id}:${option.action}`;
                const disabledItem = optionDisabled(
                  repository,
                  option.action,
                  pending,
                );

                return (
                  <DropdownMenuItem
                    key={option.action}
                    disabled={disabledItem}
                    onClick={() => void onLaunch(repository, option)}
                  >
                    {itemPending ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <Icon />
                    )}
                    <span>{optionLabel(repository, option)}</span>
                    {option.action === "remote" && repository.remoteUrl ? (
                      <DropdownMenuShortcut>
                        {repository.provider}
                      </DropdownMenuShortcut>
                    ) : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </Fragment>
        ))}
        {!repositories.length ? (
          <DropdownMenuItem disabled>
            Aucun repository configuré
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
