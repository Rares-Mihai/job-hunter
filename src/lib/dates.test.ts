import { describe, expect, it } from "vitest";
import {
  closesWithinWeek,
  daysUntil,
  describeDeadline,
  parseDay,
  startOfWeek,
  toDayString,
} from "./dates";

// Monday 16 November 2026, mid-afternoon UTC.
const NOW = new Date("2026-11-16T15:30:00Z");

describe("parseDay", () => {
  it("parses a calendar day as UTC midnight", () => {
    expect(parseDay("2026-11-19")?.toISOString()).toBe(
      "2026-11-19T00:00:00.000Z",
    );
  });

  it("rejects days that do not exist", () => {
    expect(parseDay("2026-02-31")).toBeNull();
    expect(parseDay("2026-13-01")).toBeNull();
  });

  it("rejects other formats", () => {
    expect(parseDay("19/11/2026")).toBeNull();
    expect(parseDay("2026-11-19T10:00")).toBeNull();
    expect(parseDay("")).toBeNull();
  });
});

describe("daysUntil", () => {
  it("counts whole days regardless of the time of day", () => {
    expect(daysUntil("2026-11-16", NOW)).toBe(0);
    expect(daysUntil("2026-11-17", NOW)).toBe(1);
    expect(daysUntil("2026-11-14", NOW)).toBe(-2);
  });

  it("returns null for an invalid date", () => {
    expect(daysUntil("soon", NOW)).toBeNull();
  });
});

describe("describeDeadline", () => {
  it("flags overdue deadlines", () => {
    expect(describeDeadline("2026-11-14", NOW)).toEqual({
      label: "2 days overdue",
      tone: "late",
    });
    expect(describeDeadline("2026-11-15", NOW)).toEqual({
      label: "1 day overdue",
      tone: "late",
    });
  });

  it("flags deadlines within a week as soon", () => {
    expect(describeDeadline("2026-11-16", NOW)?.label).toBe("Due today");
    expect(describeDeadline("2026-11-17", NOW)?.label).toBe("Due tomorrow");
    expect(describeDeadline("2026-11-23", NOW)).toEqual({
      label: "Due in 7 days",
      tone: "soon",
    });
  });

  it("shows the date for deadlines further away", () => {
    expect(describeDeadline("2026-12-06", NOW)).toEqual({
      label: "Due 6 Dec",
      tone: "later",
    });
  });
});

describe("closesWithinWeek", () => {
  it.each([
    ["2026-11-16", true],
    ["2026-11-23", true],
    ["2026-11-24", false],
    ["2026-11-15", false],
    ["soon", false],
  ])("%s -> %s", (deadline, expected) => {
    expect(closesWithinWeek(deadline, NOW)).toBe(expected);
  });
});

describe("startOfWeek", () => {
  it("returns the Monday of the week", () => {
    expect(toDayString(startOfWeek(NOW))).toBe("2026-11-16");
    // A Sunday belongs to the week that started six days earlier.
    expect(toDayString(startOfWeek(new Date("2026-11-22T23:59:00Z")))).toBe(
      "2026-11-16",
    );
    expect(toDayString(startOfWeek(new Date("2026-11-18T08:00:00Z")))).toBe(
      "2026-11-16",
    );
  });
});
