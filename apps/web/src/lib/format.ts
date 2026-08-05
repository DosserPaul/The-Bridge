export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function formatRelativeDate(date: string): string {
  const elapsedSeconds = (new Date(date).getTime() - Date.now()) / 1000;
  const formatter = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

  const intervals: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.345, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];

  let value = elapsedSeconds;

  for (const [limit, unit] of intervals) {
    if (Math.abs(value) < limit) {
      return formatter.format(Math.round(value), unit);
    }

    value /= limit;
  }

  return formatDate(date);
}

export function formatCalendarDate(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
    new Date(`${date}T12:00:00`),
  );
}
