import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { parseDay } from "./dates";
import { MAX_JOB_DESCRIPTION_CHARS } from "./validation";

// "Paste a link, get the posting": downloads a job page and pulls out the
// title, company, location and description.
//
// Fetching an address that a user typed is risky: without checks, someone
// could make the server read pages on its own private network. So the code
// below only talks to public internet addresses, and re-checks after every
// redirect.

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;

export type ImportedPosting = {
  company: string;
  role: string;
  location: string;
  deadline: string;
  jobDescription: string;
};

export type ImportResult =
  { ok: true; posting: ImportedPosting } | { ok: false; message: string };

/** True for addresses on the public internet; false for local and private ranges. */
export function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
    if (a === 169 && b === 254) return false; // link-local, cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 168 || b === 0)) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    if (a >= 224) return false; // multicast and reserved
    return true;
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPublicAddress(mapped[1]);
    if (lower === "::" || lower === "::1") return false;
    if (lower.startsWith("::ffff:")) return false; // other IPv4-mapped forms
    if (/^f[cd]/.test(lower)) return false; // unique local
    if (/^fe[89ab]/.test(lower)) return false; // link-local
    if (lower.startsWith("ff")) return false; // multicast
    if (lower.startsWith("64:ff9b:")) return false; // NAT64
    return true;
  }
  return false;
}

class ImportError extends Error {}

function parsePublicUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ImportError("Enter a full link, starting with https://");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ImportError("The link must start with http:// or https://");
  }
  if (url.username || url.password) {
    throw new ImportError(
      "Links with a username or password are not supported.",
    );
  }
  return url;
}

type AddressCheck = (address: string) => boolean;

/** Downloads one page, connecting only to an address that was checked first. */
async function download(
  url: URL,
  isAllowed: AddressCheck,
): Promise<{ status: number; location?: string; type: string; body: string }> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await lookup(host, { all: true }).catch(() => {
        throw new ImportError(
          "That address could not be found. Check the link.",
        );
      });
  const target = addresses[0];
  if (!target || !addresses.every((entry) => isAllowed(entry.address))) {
    throw new ImportError("That link does not point to a public website.");
  }

  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.request(
      url,
      {
        method: "GET",
        timeout: TIMEOUT_MS,
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "JobHunter/1.0 (personal job application tracker)",
        },
        // Connect to exactly the address that was checked above, so the name
        // cannot resolve to something else between the check and the request.
        lookup: (_hostname, _options, callback) =>
          callback(null, [{ address: target.address, family: target.family }]),
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            request.destroy(
              new ImportError("That page is too large to import."),
            );
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            location: response.headers.location,
            type: String(response.headers["content-type"] ?? ""),
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
        response.on("error", reject);
      },
    );
    request.on("timeout", () =>
      request.destroy(new ImportError("The website took too long to answer.")),
    );
    request.on("error", reject);
    request.end();
  });
}

/**
 * Downloads a job page and reads the posting from it. `isAllowed` decides
 * which addresses may be contacted; it exists so tests can use a local
 * server, and the app always uses the default (public addresses only).
 */
export async function importPosting(
  link: string,
  isAllowed: AddressCheck = isPublicAddress,
): Promise<ImportResult> {
  try {
    let url = parsePublicUrl(link.trim());
    for (let hop = 0; ; hop++) {
      const page = await download(url, isAllowed);
      if (page.status >= 300 && page.status < 400 && page.location) {
        if (hop >= MAX_REDIRECTS)
          throw new ImportError("That link redirects too many times.");
        url = parsePublicUrl(new URL(page.location, url).toString());
        continue;
      }
      if (page.status !== 200) {
        throw new ImportError(
          `The website refused the request (status ${page.status}). Copy the posting text by hand instead.`,
        );
      }
      if (!/html/i.test(page.type)) {
        throw new ImportError("That link is not a web page.");
      }
      const posting = extractPosting(page.body);
      if (!posting.jobDescription && !posting.role) {
        throw new ImportError(
          "No posting text was found on that page. Some sites only show it after you log in. Copy the text by hand instead.",
        );
      }
      return { ok: true, posting };
    }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof ImportError
          ? error.message
          : "The page could not be downloaded. Check the link, or copy the posting text by hand.",
    };
  }
}

// ---- Reading the page (no network below this line) ----

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (whole, code: string) => {
      if (code[0] === "#") {
        const point =
          code[1].toLowerCase() === "x"
            ? parseInt(code.slice(2), 16)
            : parseInt(code.slice(1), 10);
        return point > 0 && point <= 0x10ffff
          ? String.fromCodePoint(point)
          : "";
      }
      return ENTITIES[code.toLowerCase()] ?? whole;
    },
  );
}

/** Turns HTML into readable plain text. The result is only ever shown as text. */
export function htmlToText(html: string): string {
  const text = html
    .replace(
      /<(script|style|noscript|svg|template|head)\b[\s\S]*?<\/\1>/gi,
      " ",
    )
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(
      /<(br|\/p|\/div|\/h[1-6]|\/tr|\/ul|\/ol|\/section)\b[^>]*>/gi,
      "\n",
    )
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text)
    .replace(/[ \t\r\f\v ]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function asText(value: unknown): string {
  return typeof value === "string" ? htmlToText(value) : "";
}

type Json = Record<string, unknown>;

/** Finds a schema.org JobPosting, the structured data most job sites embed. */
function findJobPosting(html: string): Json | null {
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const block of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(block[1]);
    } catch {
      continue;
    }
    const queue: unknown[] = [data];
    for (let i = 0; i < queue.length && i < 200; i++) {
      const item = queue[i];
      if (Array.isArray(item)) queue.push(...item);
      else if (item && typeof item === "object") {
        const node = item as Json;
        const type = node["@type"];
        if (
          type === "JobPosting" ||
          (Array.isArray(type) && type.includes("JobPosting"))
        ) {
          return node;
        }
        if (node["@graph"]) queue.push(node["@graph"]);
      }
    }
  }
  return null;
}

function locationOf(job: Json): string {
  const first = Array.isArray(job.jobLocation)
    ? job.jobLocation[0]
    : job.jobLocation;
  const address = (first as Json | undefined)?.address;
  if (typeof address === "string") return asText(address);
  if (address && typeof address === "object") {
    const a = address as Json;
    return [a.addressLocality, a.addressCountry]
      .map((part) =>
        part && typeof part === "object"
          ? asText((part as Json).name)
          : asText(part),
      )
      .filter(Boolean)
      .join(", ");
  }
  return job.jobLocationType === "TELECOMMUTE" ? "Remote" : "";
}

function meta(html: string, property: string): string {
  const tag = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]*>`,
    "i",
  ).exec(html)?.[0];
  const content = tag && /content=["']([^"']*)["']/i.exec(tag)?.[1];
  return content ? decodeEntities(content).trim() : "";
}

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

export function extractPosting(html: string): ImportedPosting {
  const job = findJobPosting(html);
  if (job) {
    const organization = job.hiringOrganization;
    const day =
      typeof job.validThrough === "string" ? job.validThrough.slice(0, 10) : "";
    return {
      role: clip(asText(job.title), 160),
      company: clip(
        organization && typeof organization === "object"
          ? asText((organization as Json).name)
          : asText(organization),
        120,
      ),
      location: clip(locationOf(job), 120),
      deadline: parseDay(day) ? day : "",
      jobDescription: clip(asText(job.description), MAX_JOB_DESCRIPTION_CHARS),
    };
  }

  // No structured data: fall back to the page title and its visible text.
  const title =
    meta(html, "og:title") ||
    decodeEntities(
      /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "",
    ).trim();
  const body = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html;
  const main =
    /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(body)?.[1] ??
    /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(body)?.[1] ??
    body;
  return {
    role: clip(title.replace(/\s+/g, " "), 160),
    company: clip(meta(html, "og:site_name"), 120),
    location: "",
    deadline: "",
    jobDescription: clip(htmlToText(main), MAX_JOB_DESCRIPTION_CHARS),
  };
}
