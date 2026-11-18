import {
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { CvMatch, JobAnalysis } from "../lib/ai/schemas";
import { STATUSES } from "../lib/status";

export const applicationStatus = pgEnum("application_status", STATUSES);

export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  company: text("company").notNull(),
  role: text("role").notNull(),
  url: text("url"),
  location: text("location"),
  status: applicationStatus("status").notNull().default("wishlist"),
  // Calendar day with no time, stored and read as "YYYY-MM-DD".
  deadline: date("deadline", { mode: "string" }),
  notes: text("notes").notNull().default(""),
  jobDescription: text("job_description").notNull().default(""),
  analysis: jsonb("analysis").$type<JobAnalysis>(),
  match: jsonb("match").$type<CvMatch>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// One row per stage change, so the history and the stats can be rebuilt.
export const statusChanges = pgTable("status_changes", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  fromStatus: applicationStatus("from_status"),
  toStatus: applicationStatus("to_status").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// The CV. A single row (id = 1) until the app has user accounts.
export const profile = pgTable("profile", {
  id: integer("id").primaryKey(),
  cvText: text("cv_text").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Application = typeof applications.$inferSelect;
export type StatusChange = typeof statusChanges.$inferSelect;
