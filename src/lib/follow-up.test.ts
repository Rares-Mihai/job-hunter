import { describe, expect, it } from "vitest";
import { followUpNudge, lastAppliedAt } from "./follow-up";

const NOW = new Date("2026-11-20T15:30:00Z");
const at = (iso: string) => new Date(iso);

describe("followUpNudge", () => {
  it("shows after exactly 10 days in Applied", () => {
    const changes = [
      { toStatus: "wishlist" as const, changedAt: at("2026-11-01T10:00:00Z") },
      { toStatus: "applied" as const, changedAt: at("2026-11-10T09:00:00Z") },
    ];
    expect(followUpNudge("applied", changes, NOW)).toBe(
      "No reply in 10 days — follow up?",
    );
  });

  it("does not show after 9 days", () => {
    const changes = [
      { toStatus: "applied" as const, changedAt: at("2026-11-11T23:00:00Z") },
    ];
    expect(followUpNudge("applied", changes, NOW)).toBeNull();
  });

  it("counts from the latest move back into Applied", () => {
    const changes = [
      { toStatus: "applied" as const, changedAt: at("2026-11-15T10:00:00Z") },
      { toStatus: "applied" as const, changedAt: at("2026-10-01T10:00:00Z") },
      { toStatus: "interview" as const, changedAt: at("2026-10-05T10:00:00Z") },
    ];
    expect(followUpNudge("applied", changes, NOW)).toBeNull();

    const older = [
      { toStatus: "applied" as const, changedAt: at("2026-10-01T10:00:00Z") },
      { toStatus: "interview" as const, changedAt: at("2026-10-05T10:00:00Z") },
      { toStatus: "applied" as const, changedAt: at("2026-11-05T10:00:00Z") },
    ];
    expect(followUpNudge("applied", older, NOW)).toBe(
      "No reply in 15 days — follow up?",
    );
  });

  it("shows nothing for other stages", () => {
    const changes = [
      { toStatus: "applied" as const, changedAt: at("2026-09-01T10:00:00Z") },
    ];
    for (const status of [
      "wishlist",
      "interview",
      "offer",
      "rejected",
    ] as const) {
      expect(followUpNudge(status, changes, NOW)).toBeNull();
    }
  });

  it("falls back to the given date when there is no Applied entry", () => {
    expect(followUpNudge("applied", [], NOW, at("2026-11-01T00:00:00Z"))).toBe(
      "No reply in 19 days — follow up?",
    );
    expect(followUpNudge("applied", [], NOW)).toBeNull();
  });
});

describe("lastAppliedAt", () => {
  it("returns null without an Applied entry", () => {
    expect(
      lastAppliedAt([{ toStatus: "wishlist", changedAt: NOW }]),
    ).toBeNull();
  });
});
