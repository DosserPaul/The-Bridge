"use client";

import { useRef, useState } from "react";
import { Bot, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export function AgentAvatar({
  name,
  avatarDataUrl,
  className,
}: {
  name: string;
  avatarDataUrl: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-primary/8 text-primary",
        className,
      )}
    >
      {avatarDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarDataUrl} alt="" className="size-full object-cover" />
      ) : (
        <Bot className="size-5" strokeWidth={1.7} aria-label={name} />
      )}
    </div>
  );
}

export function AgentAvatarField({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!allowedTypes.has(file.type)) {
      setError("Utilise une image PNG, JPEG ou WebP.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("L’avatar doit peser moins de 2 Mo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result));
    reader.onerror = () => setError("Impossible de lire cette image.");
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <AgentAvatar name={name} avatarDataUrl={value} className="size-14" />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus data-icon="inline-start" />
            Importer
          </Button>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
            >
              <Trash2 data-icon="inline-start" />
              Retirer
            </Button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
