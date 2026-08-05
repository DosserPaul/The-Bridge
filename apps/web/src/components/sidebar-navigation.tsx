"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  CheckSquare2,
  FolderKanban,
  History,
  HardDrive,
  Inbox,
  Lightbulb,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Users,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { listProjects, type Project } from "@/lib/api";
import { cn } from "@/lib/utils";

interface NavigationItem {
  label: string;
  icon: LucideIcon;
  href?: string;
  match?: (pathname: string) => boolean;
}

const navigation: NavigationItem[] = [
  { label: "Today", icon: Sun },
  { label: "Inbox", icon: Inbox },
  {
    label: "Clients",
    icon: Users,
    href: "/clients",
    match: (pathname) => pathname.startsWith("/clients"),
  },
  {
    label: "Projects",
    icon: FolderKanban,
    href: "/projects",
    match: (pathname) => pathname === "/" || pathname.startsWith("/projects"),
  },
  { label: "Agents", icon: Bot },
  { label: "Actions", icon: Zap },
  { label: "Automations", icon: Workflow },
  { label: "Ideas", icon: Lightbulb },
  { label: "Security", icon: ShieldCheck },
  { label: "Approvals", icon: CheckSquare2 },
  {
    label: "Activity",
    icon: History,
    href: "/activity",
    match: (pathname) => pathname.startsWith("/activity"),
  },
  {
    label: "Integrations",
    icon: Settings2,
    href: "/settings/integrations",
    match: (pathname) => pathname.startsWith("/settings/integrations"),
  },
  {
    label: "Data",
    icon: HardDrive,
    href: "/settings/data",
    match: (pathname) => pathname.startsWith("/settings/data"),
  },
];

function NavigationRow({
  item,
  pathname,
}: {
  item: NavigationItem;
  pathname: string;
}) {
  const isActive = item.match?.(pathname) ?? false;
  const content = (
    <>
      {isActive ? (
        <span className="absolute top-1.5 bottom-1.5 -left-2 w-0.5 rounded-r bg-primary" />
      ) : null}
      <item.icon
        className={cn(
          "size-3.5 shrink-0",
          isActive ? "text-primary" : "text-muted-foreground",
        )}
        strokeWidth={1.6}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {!item.href ? (
        <span className="rounded-full border border-border bg-muted/70 px-1.5 py-0.5 font-mono text-[8px] leading-none tracking-[0.08em] text-muted-foreground uppercase">
          Soon
        </span>
      ) : null}
    </>
  );
  const classes = cn(
    "relative flex min-h-8 items-center gap-[13px] rounded-[4px] px-[11px] py-2 text-[13px] leading-[1.3] tracking-[-0.005em] transition-colors",
    isActive
      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
      : "font-normal text-muted-foreground",
    item.href
      ? "hover:bg-muted hover:text-sidebar-foreground"
      : "cursor-default",
  );

  if (!item.href) {
    return (
      <div className={classes} aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={classes}
    >
      {content}
    </Link>
  );
}

function projectColor(project: Project): string {
  if (
    project.repositories.some(
      (repository) => repository.state.availability === "unavailable",
    )
  ) {
    return "#f0534d";
  }

  if (project.repositories.some((repository) => repository.state.isDirty)) {
    return "#ddb63c";
  }

  return "#35c07f";
}

export function SidebarNavigation() {
  const pathname = usePathname();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    void listProjects(controller.signal, { silentActivity: true })
      .then((data) => setProjects(data.slice(0, 4)))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-[11px] pt-[11px] pb-[9px]">
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-[4px] border border-input bg-card px-[11px] py-2 text-left"
          aria-label="Search or run a command"
        >
          <Search className="size-3 text-muted-foreground" strokeWidth={1.9} />
          <span className="flex-1 text-[12.5px] leading-none text-muted-foreground">
            Search
          </span>
          <kbd className="rounded-[3px] border border-input px-1 py-[3px] font-mono text-[10.5px] leading-none text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>

      <nav
        className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-[11px] pb-[11px]"
        aria-label="Navigation"
      >
        {navigation.map((item) => (
          <NavigationRow key={item.label} item={item} pathname={pathname} />
        ))}

        <div className="flex items-center justify-between px-[11px] pt-[22px] pb-2">
          <span className="font-mono text-[10.5px] leading-none font-semibold tracking-[0.1em] text-muted-foreground">
            FAVORITES
          </span>
          <Plus className="size-3 text-muted-foreground" strokeWidth={2} />
        </div>

        {projects.length ? (
          projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="flex items-center gap-[13px] rounded-[4px] px-[11px] py-1 hover:bg-muted"
            >
              <span
                className="size-[5px] shrink-0 rounded-full"
                style={{ backgroundColor: projectColor(project) }}
              />
              <span className="min-w-0 flex-1 truncate text-[12.5px] leading-[1.3] text-sidebar-foreground">
                {project.name}
              </span>
              <span className="font-mono text-[10.5px] leading-none text-muted-foreground">
                {project.repositories.length} repo
              </span>
            </Link>
          ))
        ) : (
          <div className="px-[11px] py-1 font-mono text-[10.5px] text-muted-foreground">
            No favorite yet
          </div>
        )}

        <div className="mt-auto pt-5">
          <div className="rounded-[5px] border border-input bg-card p-3">
            <div className="flex items-center gap-2 font-mono text-[9.5px] font-semibold tracking-[0.1em] text-muted-foreground">
              <Sparkles className="size-3 text-primary" />
              LOCAL WORKSPACE
            </div>
            <p className="mt-2 text-[11px] leading-[1.45] text-muted-foreground">
              Repositories and credentials stay on this machine.
            </p>
          </div>
        </div>
      </nav>

      <div className="border-t border-sidebar-border p-[11px]">
        <div className="flex items-center gap-[11px] rounded-[4px] px-[9px] py-2 hover:bg-muted">
          <div className="flex size-5 shrink-0 items-center justify-center rounded-[4px] bg-secondary font-mono text-[10.5px] font-semibold text-secondary-foreground">
            PD
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs leading-[1.2] font-medium text-sidebar-foreground">
              Paul Dosser
            </p>
            <p className="mt-0.5 font-mono text-[10.5px] leading-[1.3] text-muted-foreground">
              private · local
            </p>
          </div>
          <SlidersHorizontal
            className="size-3.5 text-muted-foreground"
            strokeWidth={1.6}
          />
        </div>
      </div>
    </div>
  );
}
