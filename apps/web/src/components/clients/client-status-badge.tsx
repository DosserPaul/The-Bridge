import { Badge } from "@/components/ui/badge";
import type { ClientStatus } from "@/lib/api";

const statusDetails: Record<
  ClientStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Actif",
    className:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  prospect: {
    label: "Prospect",
    className:
      "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  paused: {
    label: "En pause",
    className:
      "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
};

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const details = statusDetails[status];
  return (
    <Badge variant="outline" className={details.className}>
      {details.label}
    </Badge>
  );
}
