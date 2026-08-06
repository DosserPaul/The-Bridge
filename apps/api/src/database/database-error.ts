export function isUniqueConstraintError(
  error: unknown,
  columnName: string,
): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const details = error as Record<string, unknown>;
  return (
    details.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    details.code === '23505' ||
    (typeof details.message === 'string' &&
      details.message.includes(columnName))
  );
}
