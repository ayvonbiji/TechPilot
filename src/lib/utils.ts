import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Remove characters that have special meaning in PostgREST filter strings. */
export function sanitizeSearch(input: string | undefined | null, max = 100): string {
  return (input ?? "").replace(/[,()*\\%_:"]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
