import { extractText, getDocumentProxy } from "unpdf";
import { MAX_CV_CHARS } from "./validation";

// Reads the text out of an uploaded CV. Only the text is kept; the PDF file
// itself is never stored.

/** Largest PDF accepted. The upload limit in next.config.ts leaves room above this. */
export const MAX_CV_PDF_BYTES = 4 * 1024 * 1024;

/** Fewer characters than this means the PDF is almost certainly a scan. */
const MIN_USEFUL_CHARS = 40;

export type CvPdfResult =
  | { ok: true; text: string; truncated: boolean }
  | { ok: false; message: string };

function looksLikePdf(bytes: Uint8Array): boolean {
  // Every PDF starts with "%PDF-" (allowing a little junk before it).
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  return head.includes("%PDF-");
}

export async function readCvPdf(bytes: Uint8Array): Promise<CvPdfResult> {
  if (bytes.byteLength === 0) {
    return { ok: false, message: "Choose a PDF file first." };
  }
  if (bytes.byteLength > MAX_CV_PDF_BYTES) {
    return {
      ok: false,
      message: "That file is too large. Upload a PDF under 4 MB.",
    };
  }
  if (!looksLikePdf(bytes)) {
    return {
      ok: false,
      message:
        "That file is not a PDF. Export your CV as a PDF and upload it again.",
    };
  }

  let raw: string;
  try {
    // PDF.js takes ownership of the buffer it is given, so hand it a copy.
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const result = await extractText(pdf, { mergePages: true });
    raw = result.text;
  } catch {
    return {
      ok: false,
      message:
        "The PDF could not be read. It may be damaged or password-protected. Export it again and retry.",
    };
  }

  const text = raw
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length < MIN_USEFUL_CHARS) {
    return {
      ok: false,
      message:
        "No text was found in that PDF. It is probably a scan or an image. Export your CV from Word or Google Docs as a PDF, or type the text below.",
    };
  }

  const truncated = text.length > MAX_CV_CHARS;
  return {
    ok: true,
    text: truncated ? text.slice(0, MAX_CV_CHARS) : text,
    truncated,
  };
}

/** A file name safe to store and show: no folders, no control characters, not too long. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return cleaned.slice(0, 120) || "cv.pdf";
}
