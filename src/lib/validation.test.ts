import { describe, expect, it } from "vitest";
import { isUuid, parseApplicationForm } from "./validation";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const VALID = {
  company: "Bitdefender",
  role: "Software Engineering Intern",
  url: "https://example.com/jobs/123",
  location: "București",
  status: "applied",
  deadline: "2026-11-19",
  notes: "Referred by a friend.",
  jobDescription: "Python and SQL.",
};

describe("parseApplicationForm", () => {
  it("accepts a complete form", () => {
    const result = parseApplicationForm(form(VALID));
    expect(result).toEqual({ ok: true, data: VALID });
  });

  it("needs only a company and a role", () => {
    const result = parseApplicationForm(
      form({ company: "  Endava ", role: " Junior Developer " }),
    );
    expect(result).toEqual({
      ok: true,
      data: {
        company: "Endava",
        role: "Junior Developer",
        url: null,
        location: null,
        status: "wishlist",
        deadline: null,
        notes: "",
        jobDescription: "",
      },
    });
  });

  it("reports each missing required field", () => {
    const result = parseApplicationForm(form({ company: "   ", role: "" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.company).toBe("Enter the company name.");
    expect(result.errors.role).toBe("Enter the role you are applying for.");
  });

  it("refuses links that are not http or https", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "ftp://example.com/file",
    ]) {
      const result = parseApplicationForm(form({ ...VALID, url }));
      expect(result.ok, url).toBe(false);
      if (!result.ok) {
        expect(result.errors.url).toBe(
          "The link must start with http:// or https://",
        );
      }
    }
  });

  it("refuses text that is not a link", () => {
    const result = parseApplicationForm(form({ ...VALID, url: "example" }));
    expect(result.ok).toBe(false);
  });

  it("refuses an unknown stage", () => {
    const result = parseApplicationForm(form({ ...VALID, status: "hired" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.status).toBe("Choose a stage.");
  });

  it("refuses a date that does not exist", () => {
    const result = parseApplicationForm(
      form({ ...VALID, deadline: "2026-02-31" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.deadline).toBe("Enter a valid date.");
  });

  it("refuses an over-long job posting", () => {
    const result = parseApplicationForm(
      form({ ...VALID, jobDescription: "x".repeat(30_001) }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.jobDescription).toBeDefined();
  });
});

describe("line breaks", () => {
  it("are stored as plain LF, however the browser sent them", () => {
    const result = parseApplicationForm(
      form({ ...VALID, notes: "a\r\nb\rc", jobDescription: "x\r\ny" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.notes).toBe("a\nb\nc");
    expect(result.data.jobDescription).toBe("x\ny");
  });
});

describe("isUuid", () => {
  it("recognises database ids", () => {
    expect(isUuid("3b67d1e0-7ca4-4a1d-b36d-1efdb1f81012")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isUuid("not-a-real-id")).toBe(false);
    expect(isUuid("3b67d1e0-7ca4-4a1d-b36d-1efdb1f81012; drop table")).toBe(
      false,
    );
    expect(isUuid("")).toBe(false);
  });
});
