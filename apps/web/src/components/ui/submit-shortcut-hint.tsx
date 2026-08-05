"use client";

import { useSyncExternalStore } from "react";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

type ShortcutModifier = "⌘" | "Ctrl";

function getShortcutModifier(): ShortcutModifier {
  const platform = `${navigator.platform} ${navigator.userAgent}`;
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? "⌘" : "Ctrl";
}

function subscribeToPlatform(onStoreChange: () => void) {
  const timeoutId = window.setTimeout(onStoreChange, 0);
  return () => window.clearTimeout(timeoutId);
}

function getServerShortcutModifier(): ShortcutModifier {
  return "Ctrl";
}

export function SubmitShortcutHint({ className }: { className?: string }) {
  const modifier = useSyncExternalStore(
    subscribeToPlatform,
    getShortcutModifier,
    getServerShortcutModifier,
  );

  return (
    <KbdGroup
      className={cn(
        "hidden text-[10.5px] text-muted-foreground sm:inline-flex",
        className,
      )}
    >
      <Kbd>{modifier}</Kbd>
      <span>+</span>
      <Kbd>Entrée</Kbd>
    </KbdGroup>
  );
}
