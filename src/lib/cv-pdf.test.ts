import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { cleanFileName, MAX_CV_PDF_BYTES, readCvPdf } from "./cv-pdf";

async function fixture(name: string): Promise<Uint8Array> {
  return new Uint8Array(
    await readFile(new URL(`./__fixtures__/${name}`, import.meta.url)),
  );
}

describe("readCvPdf", () => {
  it("reads the text of a real PDF", async () => {
    const result = await readCvPdf(await fixture("sample-cv.pdf"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toContain("Ana Popescu");
    expect(result.text).toContain("Python, SQL, Git");
    expect(result.text).toContain("Iași");
    expect(result.truncated).toBe(false);
  });

  it("explains that a PDF without text is probably a scan", async () => {
    const result = await readCvPdf(await fixture("no-text.pdf"));
    expect(result).toEqual({
      ok: false,
      message: expect.stringContaining("No text was found"),
    });
  });

  it("refuses a file that is not a PDF", async () => {
    const result = await readCvPdf(
      new TextEncoder().encode("PK\u0003\u0004 a zip"),
    );
    expect(result).toEqual({
      ok: false,
      message: expect.stringContaining("not a PDF"),
    });
  });

  it("refuses a damaged PDF without crashing", async () => {
    const result = await readCvPdf(
      new TextEncoder().encode("%PDF-1.7\nthis is not really a pdf"),
    );
    expect(result.ok).toBe(false);
  });

  it("refuses an empty or oversized file", async () => {
    expect((await readCvPdf(new Uint8Array())).ok).toBe(false);
    const big = new Uint8Array(MAX_CV_PDF_BYTES + 1);
    expect(await readCvPdf(big)).toEqual({
      ok: false,
      message: expect.stringContaining("too large"),
    });
  });
});

describe("cleanFileName", () => {
  it("keeps an ordinary name", () => {
    expect(cleanFileName("CV Ana 2026.pdf")).toBe("CV Ana 2026.pdf");
  });

  it("drops folders and control characters", () => {
    expect(cleanFileName("C:\\Users\\ana\\cv.pdf")).toBe("cv.pdf");
    expect(cleanFileName("../../etc/passwd")).toBe("passwd");
    expect(cleanFileName("cv\u0000\n.pdf")).toBe("cv.pdf");
  });

  it("falls back when nothing is left, and limits the length", () => {
    expect(cleanFileName("")).toBe("cv.pdf");
    expect(cleanFileName("a".repeat(500))).toHaveLength(120);
  });
});
