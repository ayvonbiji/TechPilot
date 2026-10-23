import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const TABLES = ["profiles", "tasks", "troubleshooting_records", "notes", "work_logs", "skills", "bookmarks"] as const;

/** Full JSON backup of the signed-in user's data (RLS limits every query to their rows). */
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const supabase = await createClient();

  const results = await Promise.all(
    TABLES.map((t) =>
      t === "profiles" ? supabase.from(t).select("*").limit(1) : supabase.from(t).select("*").eq("user_id", user.id).limit(10000),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed) return NextResponse.json({ error: "Export failed. Try again." }, { status: 500 });

  const data: Record<string, unknown> = {
    app: "TechPilot",
    format_version: 1,
    exported_at: new Date().toISOString(),
    account_email: user.email,
  };
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("role, joined_at, workspaces(name, type)")
    .eq("user_id", user.id);
  data.workspace_memberships = memberships ?? [];
  TABLES.forEach((t, i) => {
    // Generated search vectors aren't useful outside the database.
    data[t] = (results[i].data ?? []).map((row: Record<string, unknown>) => {
      const { search: _search, ...rest } = row;
      void _search;
      return rest;
    });
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="it-engineer-companion-backup_${stamp}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
