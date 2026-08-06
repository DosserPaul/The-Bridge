import { Transform } from 'class-transformer';

export function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export function trimOptionalString({ value }: { value: unknown }): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function Trimmed() {
  return Transform(trimString);
}

export function OptionalTrimmed() {
  return Transform(trimOptionalString);
}
