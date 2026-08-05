import { ChevronLeft } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { SidebarNavigation } from "@/components/sidebar-navigation";
import { TopBar } from "@/components/top-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-background text-foreground lg:grid lg:grid-cols-[258px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-svh min-h-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-[60px] shrink-0 items-center gap-[11px] border-b border-sidebar-border px-4 pl-[18px]">
          <BrandMark className="size-[21px] text-sidebar-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] leading-none font-semibold tracking-[-0.01em] text-sidebar-foreground">
              THE BRIDGE
            </p>
            <p className="mt-1 truncate text-[9.5px] leading-none text-muted-foreground">
              See everything. Direct anything.
            </p>
          </div>
          <ChevronLeft
            className="size-3.5 text-muted-foreground"
            strokeWidth={1.8}
          />
        </div>

        <SidebarNavigation />
      </aside>

      <div className="min-w-0">
        <TopBar />
        <main className="mx-auto min-h-[calc(100svh-60px)] w-full max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 lg:py-8 xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
