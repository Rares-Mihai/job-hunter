import { describe, expect, it } from "vitest";
import { countByStatus, filterCards } from "./board";
import type { Status } from "./status";

const card = (
  company: string,
  status: Status,
  role = "Intern",
  location: string | null = null,
) => ({ company, role, location, status });

const cards = [
  card("Amazon", "wishlist", "SDE Intern", "London"),
  card("Endava", "wishlist", "Junior Developer", "Cluj"),
  card("Amazon Web Services", "applied", "Cloud Intern", null),
  card("Northwind", "offer"),
];

describe("countByStatus", () => {
  it("is zero for every status when there are no cards", () => {
    expect(countByStatus([])).toEqual({
      wishlist: 0,
      applied: 0,
      interview: 0,
      offer: 0,
      rejected: 0,
    });
  });

  it("counts cards per status", () => {
    expect(countByStatus(cards)).toEqual({
      wishlist: 2,
      applied: 1,
      interview: 0,
      offer: 1,
      rejected: 0,
    });
  });

  it("changes when a card moves", () => {
    const moved = cards.map((c) =>
      c.company === "Endava" ? { ...c, status: "applied" as const } : c,
    );
    const counts = countByStatus(moved);
    expect(counts.wishlist).toBe(1);
    expect(counts.applied).toBe(2);
  });

  it("counts only cards matching the search", () => {
    const counts = countByStatus(filterCards(cards, "amazon"));
    expect(counts.wishlist).toBe(1);
    expect(counts.applied).toBe(1);
    expect(counts.offer).toBe(0);
  });
});

describe("filterCards", () => {
  it("ignores case", () => {
    expect(filterCards(cards, "ENDAVA")).toHaveLength(1);
  });

  it("needs every word to match", () => {
    expect(filterCards(cards, "amazon cloud")).toHaveLength(1);
    expect(filterCards(cards, "amazon junior")).toHaveLength(0);
  });

  it("matches on location, including a missing one", () => {
    expect(filterCards(cards, "cluj")).toHaveLength(1);
    expect(filterCards(cards, "null")).toHaveLength(0);
  });

  it("returns everything for a blank query", () => {
    expect(filterCards(cards, "   ")).toHaveLength(cards.length);
  });
});
