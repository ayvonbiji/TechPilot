import { NextResponse, type NextRequest } from "next/server";
import { getProfile, getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isIsoDate, utcRangeForDates } from "@/lib/dates";
import { toCsv } from "@/lib/reports";

/** CSV of tasks relevant to a period: completed, due or created in it, or currently in progress. */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const start = request.nextUrl.searchParams.get("start") ?? "";
  const end = request.nextUrl.searchParams.get("end") ?? "";
  if (!isIsoDate(start) || !isIsoDate(end) || start > end) {
    return NextResponse.json({ error: "Provide valid start and end dates" }, { status: 400 });
  }
  const profile = await getProfile();
  const { from, to } = utcRangeForDates(start, end, profile.timezone);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("title,category,priority,status,due_date,created_at,completed_at,completion_notes,description")
    .or(
      `and(completed_at.gte.${from},completed_at.lt.${to}),and(due_date.gte.${start},due_date.lte.${end}),and(created_at.gte.${from},created_at.lt.${to}),status.eq.in_progress`,
    )
    .order("created_at");
  if (error) return NextResponse.json({ error: "Couldn't export tasks" }, { status: 500 });

  const csv = toCsv(data ?? [], ["title", "category", "priority", "status", "due_date", "created_at", "completed_at", "completion_notes", "description"]);
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tasks_${start}_to_${end}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
