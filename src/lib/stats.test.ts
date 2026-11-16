import { describe, expect, it } from "vitest";
import {
  computeStats,
  percent,
  type StatsApplication,
  type StatsChange,
} from "./stats";
import type { Status } from "./status";

// Monday 16 November 2026.
const NOW = new Date("2026-11-16T12:00:00Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function application(
  id: string,
  status: Status,
  createdDaysAgo: number,
): StatsApplication {
  return { id, status, createdAt: daysAgo(createdDaysAgo) };
}

function change(
  applicationId: string,
  toStatus: Status,
  changedDaysAgo: number,
): StatsChange {
  return { applicationId, toStatus, changedAt: daysAgo(changedDaysAgo) };
}

describe("computeStats", () => {
  it("returns zeros and eight empty weeks when there is nothing", () => {
    const stats = computeStats([], [], NOW);
    expect(stats.total).toBe(0);
    expect(stats.sent).toBe(0);
    expect(stats.heardBack).toBe(0);
    expect(stats.reachedInterview).toBe(0);
    expect(stats.weekly).toHaveLength(8);
    expect(stats.weekly.at(-1)).toEqual({ weekStart: "2026-11-16", count: 0 });
    expect(stats.weekly[0]).toEqual({ weekStart: "2026-09-28", count: 0 });
  });

  it("counts applications per stage", () => {
    const stats = computeStats(
      [
        application("a", "wishlist", 1),
        application("b", "wishlist", 1),
        application("c", "applied", 1),
        application("d", "offer", 1),
      ],
      [],
      NOW,
    );
    expect(stats.byStatus).toEqual({
      wishlist: 2,
      applied: 1,
      interview: 0,
      offer: 1,
      rejected: 0,
    });
    expect(stats.total).toBe(4);
  });

  it("does not count wishlist items as sent", () => {
    const stats = computeStats(
      [application("a", "wishlist", 1), application("b", "applied", 1)],
      [],
      NOW,
    );
    expect(stats.sent).toBe(1);
  });

  it("counts a rejection as hearing back, but not as an interview", () => {
    const stats = computeStats(
      [application("a", "rejected", 10), application("b", "applied", 10)],
      [change("a", "applied", 9), change("a", "rejected", 2)],
      NOW,
    );
    expect(stats.sent).toBe(2);
    expect(stats.heardBack).toBe(1);
    expect(stats.reachedInterview).toBe(0);
  });

  it("remembers an interview after a later rejection", () => {
    const stats = computeStats(
      [application("a", "rejected", 30)],
      [
        change("a", "applied", 25),
        change("a", "interview", 15),
        change("a", "rejected", 5),
      ],
      NOW,
    );
    expect(stats.reachedInterview).toBe(1);
  });

  it("puts each application in the week it was first sent", () => {
    const stats = computeStats(
      [
        application("this-week", "applied", 0),
        application("last-week", "interview", 20),
        application("no-history", "applied", 8),
      ],
      [
        change("this-week", "applied", 0),
        // Sent last Tuesday, moved again this week: counts once, last week.
        change("last-week", "applied", 6),
        change("last-week", "interview", 0),
      ],
      NOW,
    );
    const byWeek = Object.fromEntries(
      stats.weekly.map((week) => [week.weekStart, week.count]),
    );
    expect(byWeek["2026-11-16"]).toBe(1);
    // "last-week" (sent 10 Nov) and "no-history" (created 8 Nov, a Sunday in
    // the week of 2 Nov) land in different weeks.
    expect(byWeek["2026-11-09"]).toBe(1);
    expect(byWeek["2026-11-02"]).toBe(1);
  });

  it("leaves out applications sent before the eight weeks shown", () => {
    const stats = computeStats(
      [application("old", "applied", 100)],
      [change("old", "applied", 90)],
      NOW,
    );
    expect(stats.sent).toBe(1);
    expect(stats.weekly.reduce((sum, week) => sum + week.count, 0)).toBe(0);
  });
});

describe("percent", () => {
  it("rounds to a whole percentage", () => {
    expect(percent(3, 7)).toBe(43);
    expect(percent(7, 7)).toBe(100);
  });

  it("returns null when there is nothing to divide by", () => {
    expect(percent(0, 0)).toBeNull();
  });
});
