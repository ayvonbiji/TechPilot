import { z } from "zod";
import { isIsoDate } from "@/lib/dates";

export const text = (max: number) => z.string().trim().max(max, `Keep this under ${max.toLocaleString()} characters`);

export const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} must be ${max} characters or fewer`);

/** "" or missing → null; otherwise a real yyyy-MM-dd date. */
export const optionalDate = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v ? v.trim() : ""))
  .refine((v) => v === "" || isIsoDate(v), "Enter a valid date")
  .transform((v) => (v === "" ? null : v));

export const requiredDate = z.string().trim().refine(isIsoDate, "Enter a valid date");

/** Accepts "dns, dhcp" or ["dns","dhcp"]; returns lowercase, unique, trimmed tags. */
export const tags = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    const raw = Array.isArray(v) ? v : (v ?? "").split(",");
    const cleaned = raw
      .map((t) => t.trim().toLowerCase().replace(/^#/, "").replace(/\s+/g, "-"))
      .filter(Boolean);
    return Array.from(new Set(cleaned));
  })
  .refine((v) => v.length <= 20, "Use 20 tags or fewer")
  .refine((v) => v.every((t) => t.length <= 30), "Each tag must be 30 characters or fewer");

export function oneOf<T extends readonly string[]>(values: T, label: string) {
  return z.enum(values as unknown as [string, ...string[]], { message: `Choose a valid ${label}` }) as unknown as z.ZodType<T[number]>;
}

export type FieldErrors = Record<string, string>;

/** Validate input with a schema and return either data or first-error-per-field messages. */
export function validate<S extends z.ZodType>(
  schema: S,
  input: unknown,
): { success: true; data: z.output<S> } | { success: false; fieldErrors: FieldErrors } {
  const result = schema.safeParse(input);
  if (result.success) return { success: true, data: result.data };
  const fieldErrors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : "_form";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { success: false, fieldErrors };
}
