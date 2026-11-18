// Creates a user with a valid session directly in the test database and
// prints the session cookies. The browser tests use this instead of going
// through GitHub, which cannot be automated. Test-only: the app itself has
// no way to sign in without GitHub.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { testUtils } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/auth-schema.ts";

const name = process.argv[2] ?? "Tester";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(drizzle(pool, { schema }), {
    provider: "pg",
    usePlural: true,
    schema,
  }),
  plugins: [testUtils()],
});

const context = await auth.$context;
const user = await context.test.saveUser(
  context.test.createUser({
    name,
    email: `${name.toLowerCase()}-${Date.now()}-${process.pid}@example.com`,
  }),
);
const cookies = await context.test.getCookies({
  userId: user.id,
  domain: "localhost",
});
console.log(JSON.stringify(cookies));
await pool.end();
