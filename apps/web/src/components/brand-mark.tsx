import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("brand-mark inline-block shrink-0", className)}
    />
  );
}
