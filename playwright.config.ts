import { defineConfig } from "@playwright/test";

// Browser tests. They need a Postgres database with the tables created:
//   E2E_DATABASE_URL=postgres://... npm run db:migrate   (with DATABASE_URL set to it)
//   npm run build && E2E_DATABASE_URL=postgres://... npm run test:e2e

const PORT = 3101;
const MOCK_CLAUDE_PORT = 3202;

export const E2E_ENV = {
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? "",
  BETTER_AUTH_SECRET: "browser-test-secret-browser-test-secret",
  BETTER_AUTH_URL: `http://localhost:${PORT}`,
  GITHUB_CLIENT_ID: "test-client-id",
  GITHUB_CLIENT_SECRET: "test-client-secret",
  // The AI features talk to the stand-in server in e2e/mock-claude.mjs.
  ANTHROPIC_API_KEY: "test-key",
  ANTHROPIC_BASE_URL: `http://127.0.0.1:${MOCK_CLAUDE_PORT}`,
  MOCK_CLAUDE_PORT: String(MOCK_CLAUDE_PORT),
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Set PW_CHANNEL=chrome to use an installed Chrome instead of the
    // browser Playwright downloads.
    channel: process.env.PW_CHANNEL,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node e2e/mock-claude.mjs",
      url: `http://127.0.0.1:${MOCK_CLAUDE_PORT}`,
      env: E2E_ENV,
      reuseExistingServer: false,
    },
    {
      command: `npm run start -- -p ${PORT}`,
      url: `http://localhost:${PORT}/demo`,
      env: E2E_ENV,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
