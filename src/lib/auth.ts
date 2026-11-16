import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/db";
import * as schema from "@/db/schema";

// Sign-in is handled by the Better Auth library. Users sign in with their
// GitHub account; the app never sees or stores a password.

/** True when every setting that sign-in needs is present. */
export function isSignInConfigured(): boolean {
  return Boolean(
    process.env.BETTER_AUTH_SECRET &&
    process.env.GITHUB_CLIENT_ID &&
    process.env.GITHUB_CLIENT_SECRET,
  );
}

function createAuth() {
  return betterAuth({
    appName: "Job Hunter",
    // BETTER_AUTH_SECRET and BETTER_AUTH_URL are read from the environment.
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      usePlural: true,
      schema,
    }),
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID ?? "",
        clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      },
    },
    account: {
      // The GitHub token the library keeps for each user is encrypted
      // before it is written to the database.
      encryptOAuthTokens: true,
    },
    // Must stay last: lets server actions set the session cookies.
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { __jobHunterAuth?: Auth };

/**
 * The auth instance. Created on first use, like the database handle, so that
 * building the app needs neither a database nor the sign-in settings.
 */
export function getAuth(): Auth {
  globalForAuth.__jobHunterAuth ??= createAuth();
  return globalForAuth.__jobHunterAuth;
}
