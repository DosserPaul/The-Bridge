"use client";

import { ChangeEvent, useRef, useState } from "react";
import { ImageUp, Trash2, TriangleAlert } from "lucide-react";
import { ClientAvatar } from "@/components/clients/client-avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_LOGO_SIZE = 2 * 1024 * 1024;
const ACCEPTED_LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function ClientLogoField({
  clientName,
  value,
  onChange,
  fieldId = "client-logo",
}: {
  clientName: string;
  value: string | null;
  onChange: (value: string | null) => void;
  fieldId?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    if (!ACCEPTED_LOGO_TYPES.has(file.type)) {
      setError("Choisis une image PNG, JPEG ou WebP.");
      return;
    }

    if (file.size > MAX_LOGO_SIZE) {
      setError("Le logo doit peser 2 Mo maximum.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setError("Impossible de lire cette image.");
        return;
      }

      setError(null);
      onChange(reader.result);
    };
    reader.onerror = () => setError("Impossible de lire cette image.");
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <ClientAvatar
        name={clientName}
        logoDataUrl={value}
        size="lg"
        className="bg-background"
      />
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={fieldId}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "cursor-pointer",
            )}
          >
            <ImageUp data-icon="inline-start" />
            {value ? "Changer le logo" : "Importer un logo"}
          </label>
          <input
            ref={inputRef}
            id={fieldId}
            type="file"
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            className="sr-only"
            onChange={handleFile}
          />
          {value ? (
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => {
                setError(null);
                onChange(null);
                inputRef.current?.focus();
              }}
            >
              <Trash2 data-icon="inline-start" />
              Retirer
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          PNG, JPEG ou WebP · 2 Mo maximum. L’image reste stockée localement.
        </p>
        {error ? (
          <p
            className="flex items-center gap-1.5 text-xs text-destructive"
            role="alert"
          >
            <TriangleAlert className="size-3.5" />
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
