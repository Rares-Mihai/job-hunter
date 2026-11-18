import { describe, expect, it } from "vitest";
import { buildReminderEmail, isCronAuthorized } from "./reminders";

const NOW = new Date("2026-11-16T07:00:00Z");

describe("buildReminderEmail", () => {
  it("names the job and how soon it closes when there is one", () => {
    const email = buildReminderEmail(
      "ana@example.com",
      "Ana",
      [{ company: "Endava", role: "Junior Developer", deadline: "2026-11-17" }],
      NOW,
      "https://jobs.example",
    );
    expect(email.to).toBe("ana@example.com");
    expect(email.subject).toBe("Deadline tomorrow: Endava");
    expect(email.text).toContain(
      "- Endava, Junior Developer: apply by 2026-11-17 (tomorrow)",
    );
    expect(email.text).toContain("https://jobs.example/account");
  });

  it("lists several jobs in one email", () => {
    const email = buildReminderEmail(
      "ana@example.com",
      "Ana",
      [
        { company: "A", role: "x", deadline: "2026-11-16" },
        { company: "B", role: "y", deadline: "2026-11-19" },
      ],
      NOW,
      "https://jobs.example",
    );
    expect(email.subject).toBe("2 application deadlines coming up");
    expect(email.text).toContain("(today)");
    expect(email.text).toContain("(in 3 days)");
  });
});

describe("isCronAuthorized", () => {
  it("accepts only the exact secret", () => {
    process.env.CRON_SECRET = "s3cret-value";
    expect(isCronAuthorized("Bearer s3cret-value")).toBe(true);
    expect(isCronAuthorized("Bearer s3cret-valuX")).toBe(false);
    expect(isCronAuthorized("Bearer s3cret")).toBe(false);
    expect(isCronAuthorized("s3cret-value")).toBe(false);
    expect(isCronAuthorized(null)).toBe(false);
  });

  it("refuses everything when no secret is set", () => {
    delete process.env.CRON_SECRET;
    expect(isCronAuthorized("Bearer ")).toBe(false);
    expect(isCronAuthorized("Bearer undefined")).toBe(false);
  });
});
