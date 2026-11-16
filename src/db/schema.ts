import {
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { CvMatch, InterviewPrep, JobAnalysis } from "../lib/ai/schemas";
import { STATUSES } from "../lib/status";
import { users } from "./auth-schema";

export * from "./auth-schema";

export const applicationStatus = pgEnum("application_status", STATUSES);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // The owner. Every read and write filters on this column.
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
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
    coverLetter: text("cover_letter"),
    interviewPrep: jsonb("interview_prep").$type<InterviewPrep>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("applications_user_id_idx").on(table.userId)],
);

// One row per stage change, so the history and the stats can be rebuilt.
export const statusChanges = pgTable(
  "status_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    fromStatus: applicationStatus("from_status"),
    toStatus: applicationStatus("to_status").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("status_changes_application_id_idx").on(table.applicationId),
  ],
);

// Each user's CV: the text the AI compares postings with, and the name of
// the PDF it was read from (when it was uploaded rather than typed).
export const cvs = pgTable("cvs", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  text: text("text").notNull().default(""),
  fileName: text("file_name"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// How many AI requests each user made on each day (UTC). The daily limits
// that protect the API key's budget are enforced against this table.
export const aiUsage = pgTable(
  "ai_usage",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.day] })],
);

// The number of applications each user aims to send per week.
export const goals = pgTable("goals", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  weeklyTarget: integer("weekly_target").notNull(),
});

export type Application = typeof applications.$inferSelect;
export type StatusChange = typeof statusChanges.$inferSelect;
export type Cv = typeof cvs.$inferSelect;
