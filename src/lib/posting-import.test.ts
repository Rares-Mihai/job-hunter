import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  extractPosting,
  htmlToText,
  importPosting,
  isPublicAddress,
} from "./posting-import";

describe("isPublicAddress", () => {
  it("accepts public addresses", () => {
    expect(isPublicAddress("93.184.216.34")).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
  });

  it("rejects local and private addresses", () => {
    for (const address of [
      "127.0.0.1",
      "10.0.0.5",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "::1",
      "::",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "not-an-ip",
    ]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });
});

describe("importPosting", () => {
  it("refuses links to the server's own network without connecting", async () => {
    for (const link of [
      "http://127.0.0.1:5432/",
      "http://localhost/",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::1]/",
      "http://192.168.0.1/admin",
    ]) {
      const result = await importPosting(link);
      expect(result, link).toEqual({
        ok: false,
        message: "That link does not point to a public website.",
      });
    }
  });

  it("refuses anything that is not an http link", async () => {
    expect((await importPosting("file:///etc/passwd")).ok).toBe(false);
    expect((await importPosting("javascript:alert(1)")).ok).toBe(false);
    expect((await importPosting("https://user:pw@example.com/")).ok).toBe(
      false,
    );
    expect((await importPosting("jobs")).ok).toBe(false);
  });
});

describe("htmlToText", () => {
  it("drops scripts and tags, keeps the reading order", () => {
    expect(
      htmlToText(
        "<p>We need:</p><ul><li>Python &amp; SQL</li><li>Git</li></ul><script>alert(1)</script>",
      ),
    ).toBe("We need:\n\n- Python & SQL\n- Git");
  });

  it("decodes character codes", () => {
    expect(htmlToText("Ia&#537;i &#x2014; caf&eacute;")).toBe(
      "Iași — caf&eacute;",
    );
  });
});

describe("extractPosting", () => {
  it("reads a schema.org JobPosting", () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify(
      {
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebSite", name: "Jobs" },
          {
            "@type": "JobPosting",
            title: "Software Engineer Intern",
            hiringOrganization: {
              "@type": "Organization",
              name: "Example SRL",
            },
            jobLocation: {
              address: { addressLocality: "Iași", addressCountry: "RO" },
            },
            validThrough: "2026-12-01T23:59:00Z",
            description: "<p>Build things.</p><ul><li>Python</li></ul>",
          },
        ],
      },
    )}</script></head><body>ignored</body></html>`;
    expect(extractPosting(html)).toEqual({
      role: "Software Engineer Intern",
      company: "Example SRL",
      location: "Iași, RO",
      deadline: "2026-12-01",
      jobDescription: "Build things.\n\n- Python",
    });
  });

  it("falls back to the title and visible text", () => {
    const html =
      '<html><head><title>Junior Developer | Acme</title><meta property="og:site_name" content="Acme"></head>' +
      "<body><nav>Menu</nav><main><h1>Junior Developer</h1><p>You will write code.</p></main></body></html>";
    expect(extractPosting(html)).toEqual({
      role: "Junior Developer | Acme",
      company: "Acme",
      location: "",
      deadline: "",
      jobDescription: "Junior Developer\nYou will write code.",
    });
  });

  it("survives broken structured data", () => {
    const html =
      '<script type="application/ld+json">{not json</script><title>Role</title><body><p>Text</p></body>';
    expect(extractPosting(html).jobDescription).toBe("Text");
  });
});

describe("importPosting against a local test server", () => {
  const JOB_PAGE = `<html><head><script type="application/ld+json">${JSON.stringify(
    {
      "@type": "JobPosting",
      title: "Backend Intern",
      hiringOrganization: { name: "Test SRL" },
      description: "<p>Write code.</p>",
    },
  )}</script></head><body></body></html>`;

  let server: http.Server;
  let base: string;
  // The test server is local, so these tests allow exactly its address.
  const onlyTestServer = (address: string) => address === "127.0.0.1";

  beforeAll(async () => {
    server = http.createServer((request, response) => {
      const html = { "content-type": "text/html; charset=utf-8" };
      if (request.url === "/job") {
        response.writeHead(200, html).end(JOB_PAGE);
      } else if (request.url === "/moved") {
        response.writeHead(302, { location: "/job" }).end();
      } else if (request.url === "/to-private") {
        response
          .writeHead(302, { location: "http://127.0.0.2:1/secret" })
          .end();
      } else if (request.url === "/loop") {
        response.writeHead(302, { location: "/loop" }).end();
      } else if (request.url === "/huge") {
        response.writeHead(200, html).end("x".repeat(2_000_000));
      } else if (request.url === "/pdf") {
        response
          .writeHead(200, { "content-type": "application/pdf" })
          .end("%PDF");
      } else if (request.url === "/empty") {
        response.writeHead(200, html).end("<html><body></body></html>");
      } else {
        response.writeHead(404, html).end("nope");
      }
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  it("downloads a page and reads the posting", async () => {
    expect(await importPosting(`${base}/job`, onlyTestServer)).toEqual({
      ok: true,
      posting: {
        role: "Backend Intern",
        company: "Test SRL",
        location: "",
        deadline: "",
        jobDescription: "Write code.",
      },
    });
  });

  it("follows a redirect", async () => {
    expect((await importPosting(`${base}/moved`, onlyTestServer)).ok).toBe(
      true,
    );
  });

  it("re-checks the address after a redirect", async () => {
    expect(await importPosting(`${base}/to-private`, onlyTestServer)).toEqual({
      ok: false,
      message: "That link does not point to a public website.",
    });
  });

  it("gives up on endless redirects", async () => {
    expect(await importPosting(`${base}/loop`, onlyTestServer)).toEqual({
      ok: false,
      message: "That link redirects too many times.",
    });
  });

  it("stops reading a page that is too large", async () => {
    expect(await importPosting(`${base}/huge`, onlyTestServer)).toEqual({
      ok: false,
      message: "That page is too large to import.",
    });
  });

  it("explains pages it cannot use", async () => {
    const message = async (path: string) => {
      const result = await importPosting(`${base}${path}`, onlyTestServer);
      return result.ok ? "ok" : result.message;
    };
    expect(await message("/missing")).toContain("status 404");
    expect(await message("/pdf")).toBe("That link is not a web page.");
    expect(await message("/empty")).toContain("No posting text was found");
  });

  it("still refuses the same server with the default check", async () => {
    expect((await importPosting(`${base}/job`)).ok).toBe(false);
  });
});
