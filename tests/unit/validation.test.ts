import { describe, expect, it } from "vitest";
import { validate } from "@/lib/validation/common";
import { bookmarkSchema, signUpSchema, skillSchema, taskSchema, troubleshootingSchema, workLogSchema } from "@/lib/validation/schemas";
import { sanitizeSearch } from "@/lib/utils";

describe("validation", () => {
  it("requires a task title and valid enums", () => {
    const r = validate(taskSchema, { title: "  ", category: "General", priority: "urgent", status: "pending", due_date: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.fieldErrors.title).toBe("Title is required");
      expect(r.fieldErrors.priority).toBeDefined();
    }
  });

  it("turns an empty due date into null and trims text", () => {
    const r = validate(taskSchema, { title: " Patch PC ", category: "General", priority: "low", status: "pending", due_date: "" });
    expect(r.success && r.data).toMatchObject({ title: "Patch PC", due_date: null });
  });

  it("rejects impossible dates", () => {
    const r = validate(taskSchema, { title: "x", category: "G", priority: "low", status: "pending", due_date: "2026-02-31" });
    expect(r.success).toBe(false);
  });

  it("normalises tags", () => {
    const r = validate(troubleshootingSchema, {
      title: "t",
      category: "Networking",
      status: "investigating",
      symptoms: "s",
      tags: " DNS, #dhcp, dns, Wi Fi ",
    });
    expect(r.success && r.data.tags).toEqual(["dns", "dhcp", "wi-fi"]);
  });

  it("needs a solution for resolved records", () => {
    const r = validate(troubleshootingSchema, { title: "t", category: "Networking", status: "resolved", symptoms: "s" });
    expect(!r.success && r.fieldErrors.solution).toBeTruthy();
  });

  it("rejects non-web bookmark URLs", () => {
    for (const url of ["javascript:alert(1)", "ftp://x.com", "example.com", "https://exa mple.com"]) {
      expect(validate(bookmarkSchema, { title: "x", url, category: "Useful tools" }).success).toBe(false);
    }
    expect(validate(bookmarkSchema, { title: "x", url: "https://example.com/a?b=1", category: "Useful tools" }).success).toBe(true);
  });

  it("requires a completion date for completed skills", () => {
    const base = { name: "x", kind: "skill", category: "Other", current_level: "3", target_level: "3", status: "completed" };
    expect(validate(skillSchema, { ...base, completed_on: "" }).success).toBe(false);
    expect(validate(skillSchema, { ...base, completed_on: "2026-10-01" }).success).toBe(true);
  });

  it("requires at least one work-log section", () => {
    expect(validate(workLogSchema, { log_date: "2026-10-23" }).success).toBe(false);
    expect(validate(workLogSchema, { log_date: "2026-10-23", reflections: "ok" }).success).toBe(true);
  });

  it("enforces password strength on sign-up", () => {
    expect(validate(signUpSchema, { displayName: "A", email: "a@example.com", password: "password" }).success).toBe(false);
    expect(validate(signUpSchema, { displayName: "A", email: "a@example.com", password: "passw0rd" }).success).toBe(true);
  });

  it("strips characters that could alter PostgREST filters", () => {
    expect(sanitizeSearch('dns),title.eq.x,("')).toBe("dns title.eq.x");
    expect(sanitizeSearch("a".repeat(200)).length).toBe(100);
  });
});
