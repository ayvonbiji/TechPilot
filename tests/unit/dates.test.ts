import { describe, expect, it } from "vitest";
import { addDays, formatDate, isIsoDate, localDateOf, startOfLocalDay, utcRangeForDates, weekRange } from "@/lib/dates";

describe("dates", () => {
  it("validates real calendar dates only", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-2-3")).toBe(false);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("uses Monday-to-Sunday weeks", () => {
    expect(weekRange("2026-10-23")).toEqual({ start: "2026-10-19", end: "2026-10-25" }); // Friday
    expect(weekRange("2026-10-25")).toEqual({ start: "2026-10-19", end: "2026-10-25" }); // Sunday
    expect(weekRange("2026-10-19")).toEqual({ start: "2026-10-19", end: "2026-10-25" }); // Monday
  });

  it("finds the local day of an instant in a time zone", () => {
    // 20:00 UTC is already the next day in India (UTC+5:30)
    expect(localDateOf("2026-10-23T20:00:00Z", "Asia/Kolkata")).toBe("2026-10-24");
    expect(localDateOf("2026-10-23T20:00:00Z", "UTC")).toBe("2026-10-23");
  });

  it("computes local midnight in UTC, including DST zones", () => {
    expect(startOfLocalDay("2026-10-23", "Asia/Kolkata").toISOString()).toBe("2026-10-22T18:30:00.000Z");
    expect(startOfLocalDay("2026-07-01", "Europe/London").toISOString()).toBe("2026-06-30T23:00:00.000Z");
    expect(startOfLocalDay("2026-01-15", "Europe/London").toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });

  it("builds a half-open UTC range for local dates", () => {
    expect(utcRangeForDates("2026-10-23", "2026-10-23", "Asia/Kolkata")).toEqual({
      from: "2026-10-22T18:30:00.000Z",
      to: "2026-10-23T18:30:00.000Z",
    });
  });

  it("falls back to UTC for an invalid zone", () => {
    expect(localDateOf("2026-10-23T20:00:00Z", "Not/AZone")).toBe("2026-10-23");
  });

  it("formats dates in each supported format", () => {
    expect(formatDate("2026-03-09")).toBe("09 Mar 2026");
    expect(formatDate("2026-03-09", "dd/MM/yyyy")).toBe("09/03/2026");
    expect(formatDate("2026-03-09", "MM/dd/yyyy")).toBe("03/09/2026");
    expect(formatDate(null)).toBe("—");
  });
});
