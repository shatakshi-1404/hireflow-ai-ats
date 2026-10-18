export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

export function timeAgo(iso: string, now: number = Date.now()): string {
  const diff = (new Date(iso).getTime() - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, seconds] of UNITS) {
    if (Math.abs(diff) >= seconds) return rtf.format(Math.round(diff / seconds), unit);
  }
  return "just now";
}

/** "python, SQL; docker" -> ["python", "SQL", "docker"] */
export function parseList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isValidSkillList(value: string): boolean {
  const items = parseList(value);
  return items.length <= 100 && items.every((s) => s.length <= 60);
}

export function parseOptionalNumber(value: string): number | null {
  const t = value.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function isValidOptionalNumber(value: string, min = 0, max = 60): boolean {
  const t = value.trim();
  if (t === "") return true;
  const n = Number(t);
  return Number.isFinite(n) && n >= min && n <= max;
}

export function emptyToNull(value: string): string | null {
  const t = value.trim();
  return t === "" ? null : t;
}

/** YYYY-MM-DD, `days` days before today, in UTC (the backend buckets by UTC day). */
export function utcDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function safeHttpUrl(value: string | null): string | null {
  return value && /^https?:\/\//i.test(value) ? value : null;
}
