import type { LocalActionName } from "@/lib/api";

export interface ProjectLocalActionOption {
  action: LocalActionName;
  label: string;
}

export const projectOpenActions = [
  { action: "editor", label: "VS Code" },
  { action: "terminal", label: "Terminal" },
  { action: "finder", label: "Finder" },
  { action: "remote", label: "Repository distant" },
] as const satisfies readonly ProjectLocalActionOption[];

export const projectCommandActions = [
  { action: "dev", label: "Dev" },
  { action: "test", label: "Tests" },
  { action: "lint", label: "Lint" },
  { action: "build", label: "Build" },
  { action: "coverage", label: "Coverage" },
  { action: "audit", label: "Audit" },
  { action: "outdated", label: "Dépendances" },
] as const satisfies readonly ProjectLocalActionOption[];
