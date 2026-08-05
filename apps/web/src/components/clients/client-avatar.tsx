import Image from "next/image";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "size-9 rounded-lg text-[10px]",
  md: "size-11 rounded-xl text-xs",
  lg: "size-20 rounded-2xl text-base",
};

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function ClientAvatar({
  name,
  logoDataUrl,
  size = "md",
  className,
}: {
  name: string;
  logoDataUrl: string | null;
  size?: keyof typeof sizeClasses;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden border bg-muted/45 font-mono font-semibold text-foreground",
        sizeClasses[size],
        className,
      )}
    >
      {logoDataUrl ? (
        <Image
          src={logoDataUrl}
          alt={`Logo ${name || "du client"}`}
          fill
          sizes={size === "lg" ? "80px" : size === "md" ? "44px" : "36px"}
          unoptimized
          className="object-contain p-1.5"
        />
      ) : (
        <span aria-hidden="true">{initials(name) || "CL"}</span>
      )}
    </span>
  );
}
