export const PARIS_TZ = "Europe/Paris";
const DAY_MS = 86_400_000;
const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: PARIS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function parisDay(iso: string): string {
  return fmt.format(new Date(iso)); // en-CA formats as YYYY-MM-DD
}
// Noon UTC avoids any DST edge when doing pure calendar arithmetic.
const noon = (day: string) => Date.parse(`${day}T12:00:00.000Z`);

export function addDays(day: string, n: number): string {
  return new Date(noon(day) + n * DAY_MS).toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((noon(b) - noon(a)) / DAY_MS);
}
export function startOfParisWeek(iso: string): string {
  const day = parisDay(iso);
  const dow = new Date(noon(day)).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}
export function addDaysIso(iso: string, n: number): string {
  return new Date(Date.parse(iso) + n * DAY_MS).toISOString();
}
