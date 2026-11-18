import { defineConfig } from "drizzle-kit";

// drizzle-kit does not read .env files by itself.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: rely on variables already in the environment (CI, Vercel).
}

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/db/schema.ts", "./src/db/auth-schema.ts"],
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
