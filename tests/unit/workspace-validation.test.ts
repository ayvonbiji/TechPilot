import { describe, expect, it } from "vitest";
import { validate } from "@/lib/validation/common";
import { inviteSchema, workspaceCreateSchema, workspaceUpdateSchema } from "@/lib/validation/schemas";

describe("workspace validation", () => {
  it("only allows freelance and organisation workspaces to be created", () => {
    expect(validate(workspaceCreateSchema, { name: "Acme", type: "personal", ticket_prefix: "AC" }).success).toBe(false);
    expect(validate(workspaceCreateSchema, { name: "Acme", type: "organisation", ticket_prefix: "ac" }).success).toBe(true);
  });

  it("uppercases and checks the ticket prefix", () => {
    const ok = validate(workspaceCreateSchema, { name: "Acme", type: "freelance", ticket_prefix: " acme " });
    expect(ok.success && ok.data.ticket_prefix).toBe("ACME");
    for (const bad of ["A", "A1", "TOOLONGX", "A-B"]) {
      expect(validate(workspaceCreateSchema, { name: "x", type: "freelance", ticket_prefix: bad }).success).toBe(false);
    }
  });

  it("accepts only hex colours and https logo URLs", () => {
    const base = { name: "Acme", ticket_prefix: "AC" };
    expect(validate(workspaceUpdateSchema, { ...base, brand_color: "", logo_url: "" }).success).toBe(true);
    expect(validate(workspaceUpdateSchema, { ...base, brand_color: "red", logo_url: "" }).success).toBe(false);
    expect(validate(workspaceUpdateSchema, { ...base, brand_color: "#1F6FEB", logo_url: "http://x.com/a.png" }).success).toBe(false);
    expect(validate(workspaceUpdateSchema, { ...base, brand_color: "", logo_url: "javascript:alert(1)" }).success).toBe(false);
    const ok = validate(workspaceUpdateSchema, { ...base, brand_color: "#1F6FEB", logo_url: "https://example.com/logo.png" });
    expect(ok.success && ok.data).toMatchObject({ brand_color: "#1f6feb", logo_url: "https://example.com/logo.png" });
  });

  it("never lets an invitation grant ownership", () => {
    expect(validate(inviteSchema, { email: "a@example.com", role: "owner" }).success).toBe(false);
    expect(validate(inviteSchema, { email: "A@Example.com", role: "agent" }).success).toBe(true);
  });
});
