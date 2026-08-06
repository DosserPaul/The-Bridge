"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bot,
  FolderKanban,
  HardDrive,
  History,
  Inbox,
  Lightbulb,
  Menu,
  PlugZap,
  Search,
  ShieldCheck,
  Users,
  X,
  Zap,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { ProjectHeaderActions } from "@/components/projects/project-header-actions";
import { ThemeToggle } from "@/components/theme-toggle";

const mobileNavigation = [
  { label: "Inbox", icon: Inbox },
  { label: "Clients", icon: Users, href: "/clients" },
  { label: "Projects", icon: FolderKanban, href: "/projects" },
  { label: "Agents", icon: Bot },
  { label: "Actions", icon: Zap },
  { label: "Ideas", icon: Lightbulb },
  { label: "Security", icon: ShieldCheck },
  { label: "Activity", icon: History, href: "/activity" },
  { label: "Integrations", icon: PlugZap, href: "/settings/integrations" },
  { label: "Data", icon: HardDrive, href: "/settings/data" },
];

function breadcrumbs(pathname: string): string[] {
  if (pathname.startsWith("/activity")) return ["Workspace", "Activity"];
  if (pathname === "/clients/new") return ["Workspace", "Clients", "New"];
  if (pathname.endsWith("/edit") && pathname.startsWith("/clients/")) {
    return ["Workspace", "Clients", "Edit"];
  }
  if (pathname.startsWith("/clients/")) {
    return ["Workspace", "Clients", "Overview"];
  }
  if (pathname.startsWith("/clients")) return ["Workspace", "Clients"];
  if (pathname === "/projects/new") return ["Workspace", "Projects", "New"];
  if (pathname.endsWith("/edit") && pathname.startsWith("/projects/")) {
    return ["Workspace", "Projects", "Edit"];
  }
  if (
    pathname.endsWith("/repositories/new") &&
    pathname.startsWith("/projects/")
  ) {
    return ["Workspace", "Projects", "Repository", "New"];
  }
  if (pathname.startsWith("/projects/")) {
    return ["Workspace", "Projects", "Overview"];
  }
  if (pathname.startsWith("/settings/integrations")) {
    return ["Workspace", "Settings", "Integrations"];
  }
  if (pathname.startsWith("/settings/data")) {
    return ["Workspace", "Settings", "Data"];
  }
  return ["Workspace", "Projects"];
}

export function TopBar() {
  const pathname = usePathname();
  const items = breadcrumbs(pathname);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b border-sidebar-border bg-sidebar/95 px-4 backdrop-blur-md sm:px-[19px]">
        <button
          type="button"
          className="flex size-[27px] items-center justify-center rounded-[4px] border border-input bg-card lg:hidden"
          aria-label="Open navigation"
          aria-controls="mobile-navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <Menu className="size-3.5 text-muted-foreground" strokeWidth={1.7} />
        </button>

        <div className="flex items-center gap-2.5 lg:hidden">
          <BrandMark className="size-[20px] text-sidebar-foreground" />
          <span className="hidden text-[13px] font-semibold tracking-[-0.01em] text-sidebar-foreground min-[360px]:inline">
            THE BRIDGE
          </span>
        </div>

        <div className="hidden items-center gap-2.5 text-[13px] leading-none lg:flex">
          {items.map((item, index) => (
            <div key={item} className="flex items-center gap-2.5">
              {index ? (
                <span className="text-muted-foreground/45">/</span>
              ) : null}
              <span
                className={
                  index === items.length - 1
                    ? "font-medium text-foreground"
                    : "font-normal text-muted-foreground"
                }
              >
                {item}
              </span>
            </div>
          ))}
        </div>

        <div className="flex-1" />

        <div className="hidden items-center gap-2 rounded-[4px] border border-input bg-card px-[11px] py-1.5 sm:flex">
          <span className="size-[5px] rounded-full bg-[#35c07f] shadow-[0_0_0_3px_rgba(53,192,127,0.08)]" />
          <span className="text-xs leading-none font-medium text-card-foreground">
            Local API
          </span>
        </div>

        <ProjectHeaderActions pathname={pathname} />

        <button
          type="button"
          className="hidden w-[190px] items-center gap-2 rounded-[4px] border border-input bg-card px-2.5 py-1.5 xl:flex"
          aria-label="Search or run a command"
        >
          <Search className="size-3 text-muted-foreground" strokeWidth={1.9} />
          <span className="flex-1 text-left text-[12.5px] leading-none text-muted-foreground">
            Search or run
          </span>
          <span className="font-mono text-[10.5px] leading-none text-muted-foreground">
            ⌘K
          </span>
        </button>

        <ThemeToggle />

        <button
          type="button"
          className="relative flex size-[27px] items-center justify-center rounded-[4px] border border-input bg-card"
          aria-label="Notifications"
        >
          <Bell className="size-3.5 text-muted-foreground" strokeWidth={1.6} />
          <span className="absolute top-1 right-1 size-[5px] rounded-full border border-card bg-[#f0534d]" />
        </button>

        <div className="flex size-[27px] items-center justify-center rounded-[4px] bg-secondary font-mono text-[11px] font-semibold text-secondary-foreground">
          PD
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          />
          <aside
            id="mobile-navigation"
            className="relative flex h-full w-[min(320px,calc(100vw-32px))] flex-col border-r border-sidebar-border bg-sidebar shadow-[24px_0_80px_rgba(0,0,0,0.3)]"
          >
            <div className="flex h-[60px] items-center gap-2.5 border-b border-sidebar-border px-4">
              <BrandMark className="size-6 text-sidebar-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-sidebar-foreground">
                  THE BRIDGE
                </p>
                <p className="truncate text-[10.5px] text-muted-foreground">
                  See everything. Direct anything.
                </p>
              </div>
              <button
                type="button"
                className="flex size-7 items-center justify-center rounded-[4px] border border-input bg-card"
                aria-label="Close navigation"
                onClick={() => setMenuOpen(false)}
              >
                <X
                  className="size-3.5 text-muted-foreground"
                  strokeWidth={1.7}
                />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-4">
              <p className="px-2 pb-2 font-mono text-[9.5px] font-medium tracking-[0.13em] text-muted-foreground uppercase">
                Mission Control
              </p>
              {mobileNavigation.map((item) => {
                const Icon = item.icon;
                const active = item.href
                  ? pathname === item.href ||
                    pathname.startsWith(`${item.href}/`)
                  : false;
                const className = `relative flex h-9 w-full items-center gap-3 rounded-[4px] px-2.5 text-[13px] transition-colors ${
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : item.href
                      ? "text-muted-foreground hover:bg-muted hover:text-sidebar-foreground"
                      : "cursor-default text-muted-foreground/65"
                }`;

                if (!item.href) {
                  return (
                    <div key={item.label} className={className}>
                      <Icon className="size-4" strokeWidth={1.55} />
                      <span>{item.label}</span>
                      <span className="ml-auto rounded-full border border-border bg-muted/70 px-1.5 py-0.5 font-mono text-[8px] leading-none tracking-[0.08em] text-muted-foreground uppercase">
                        Soon
                      </span>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={className}
                    onClick={() => setMenuOpen(false)}
                  >
                    {active ? (
                      <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-primary" />
                    ) : null}
                    <Icon className="size-4" strokeWidth={1.55} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-sidebar-border p-3">
              <div className="flex items-center gap-2.5 rounded-[5px] border border-input bg-card px-2.5 py-2.5">
                <span className="size-2 rounded-full bg-[#35c07f]" />
                <div className="min-w-0">
                  <p className="text-[11.5px] font-medium text-card-foreground">
                    Local workspace
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    API connected
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
