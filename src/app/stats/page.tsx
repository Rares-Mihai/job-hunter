import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GoalForm } from "@/components/GoalForm";
import {
  getWeeklyTarget,
  listAllStatusChanges,
  listApplications,
  MAX_WEEKLY_TARGET,
} from "@/lib/applications";
import { parseDay } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { computeStats, percent, type Stats } from "@/lib/stats";
import { STATUS_LABELS, STATUSES } from "@/lib/status";

export const metadata: Metadata = { title: "Stats" };

export default function StatsPage() {
  return (
    <div>
      <h1 className="text-4xl font-bold">Stats</h1>
      <div className="mt-8">
        <Suspense fallback={<p className="text-ink-soft">Counting…</p>}>
          <StatsData />
        </Suspense>
      </div>
    </div>
  );
}

async function StatsData() {
  const user = await requireUser();
  const [applications, changes, target] = await Promise.all([
    listApplications(user.id),
    listAllStatusChanges(user.id),
    getWeeklyTarget(user.id),
  ]);

  if (applications.length === 0) {
    return (
      <div className="max-w-xl">
        <p className="text-lg text-ink-soft">
          Nothing to count yet. Once you add applications and move them across
          the board, this page shows how many you send each week and how many
          get an answer.
        </p>
        <Link href="/applications/new" className="btn btn-primary mt-6">
          Add application
        </Link>
      </div>
    );
  }

  const stats = computeStats(applications, changes, new Date());

  return (
    <div className="flex flex-col gap-12">
      <Tiles stats={stats} />
      <div className="grid gap-x-14 gap-y-12 lg:grid-cols-2">
        <WeeklyChart weekly={stats.weekly} />
        <StageChart stats={stats} />
      </div>
      <section aria-labelledby="goal-heading">
        <h2 id="goal-heading" className="text-2xl font-bold">
          Weekly goal
        </h2>
        <p className="mt-1 mb-4 max-w-[60ch] text-ink-soft">
          {stats.sentThisWeek} sent so far this week
          {stats.streakWeeks >= 2
            ? `, and ${stats.streakWeeks} weeks in a row with at least one.`
            : "."}
        </p>
        <GoalForm target={target} max={MAX_WEEKLY_TARGET} />
      </section>
    </div>
  );
}

function Tiles({ stats }: { stats: Stats }) {
  const heardBack = percent(stats.heardBack, stats.sent);
  const interviews = percent(stats.reachedInterview, stats.sent);
  const noneSent = "No applications sent yet";

  return (
    <dl className="grid grid-cols-2 gap-x-10 gap-y-8 lg:grid-cols-4">
      <Tile
        label="Tracked"
        value={String(stats.total)}
        detail="applications on the board"
      />
      <Tile
        label="Sent"
        value={String(stats.sent)}
        detail="left the wishlist"
      />
      <Tile
        label="Heard back"
        value={heardBack === null ? "–" : `${heardBack}%`}
        detail={
          heardBack === null
            ? noneSent
            : `${stats.heardBack} of ${stats.sent} sent got an answer`
        }
      />
      <Tile
        label="Reached an interview"
        value={interviews === null ? "–" : `${interviews}%`}
        detail={
          interviews === null
            ? noneSent
            : `${stats.reachedInterview} of ${stats.sent} sent`
        }
      />
    </dl>
  );
}

function Tile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex flex-col border-t-2 border-ink pt-3">
      <dt className="font-semibold">{label}</dt>
      <dd className="mt-1 text-4xl leading-tight font-semibold">{value}</dd>
      <dd className="mt-1 text-sm text-ink-soft">{detail}</dd>
    </div>
  );
}

const WEEK_LABEL = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const WEEK_DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  timeZone: "UTC",
});
const WEEK_MONTH = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  timeZone: "UTC",
});

/*
  Both charts use one colour: the bars differ in length, not in kind, and each
  bar is named by the label next to it. Every value is printed, so the hover
  note only repeats what is already readable (and reachable without a mouse).
*/

function WeeklyChart({ weekly }: { weekly: Stats["weekly"] }) {
  const max = Math.max(1, ...weekly.map((week) => week.count));
  const total = weekly.reduce((sum, week) => sum + week.count, 0);

  return (
    <section aria-labelledby="weekly-heading">
      <h2 id="weekly-heading" className="text-2xl font-bold">
        Applications sent per week
      </h2>
      <p className="mt-1 text-ink-soft">
        {total === 0
          ? "None in the last 8 weeks."
          : `${total} in the last 8 weeks. Weeks start on Monday.`}
      </p>
      <ol className="mt-10 flex items-end gap-2 border-b border-line">
        {weekly.map((week) => {
          const day = parseDay(week.weekStart);
          const label = day ? WEEK_LABEL.format(day) : week.weekStart;
          return (
            <li
              key={week.weekStart}
              className="group relative flex h-44 flex-1 flex-col items-center justify-end"
            >
              <span
                className={`mb-1 text-sm font-medium ${
                  week.count === 0 ? "text-ink-soft" : ""
                }`}
                aria-hidden="true"
              >
                {week.count}
              </span>
              <span
                aria-hidden="true"
                className="w-full max-w-6 rounded-t bg-pen group-hover:bg-pen-dark"
                style={{ height: `${(week.count / max) * 80}%` }}
              />
              <span className="sr-only">
                Week of {label}: {week.count} sent
              </span>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 rounded bg-ink px-2 py-1 text-sm whitespace-nowrap text-white group-hover:block"
              >
                <strong>{week.count}</strong> sent, week of {label}
              </span>
            </li>
          );
        })}
      </ol>
      <ol aria-hidden="true" className="mt-1.5 flex gap-2">
        {weekly.map((week) => {
          const day = parseDay(week.weekStart);
          return (
            <li
              key={week.weekStart}
              className="flex-1 text-center text-xs text-ink-soft"
            >
              {/* Day above month on narrow screens, so the label never wraps mid-word. */}
              {day && (
                <>
                  <span className="block sm:inline">
                    {WEEK_DAY.format(day)}
                  </span>{" "}
                  <span className="block sm:inline">
                    {WEEK_MONTH.format(day)}
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StageChart({ stats }: { stats: Stats }) {
  const max = Math.max(1, ...STATUSES.map((status) => stats.byStatus[status]));

  return (
    <section aria-labelledby="stage-heading">
      <h2 id="stage-heading" className="text-2xl font-bold">
        Where they stand now
      </h2>
      <p className="mt-1 text-ink-soft">
        Applications in each stage of the board.
      </p>
      <ul className="mt-6 flex flex-col gap-3">
        {STATUSES.map((status) => {
          const count = stats.byStatus[status];
          const share = percent(count, stats.total) ?? 0;
          return (
            <li
              key={status}
              className="group relative grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3"
            >
              <span>{STATUS_LABELS[status]}</span>
              <span className="flex items-center gap-2 border-l border-line">
                <span
                  aria-hidden="true"
                  className="h-5 rounded-r bg-pen group-hover:bg-pen-dark"
                  style={{ width: `${(count / max) * 85}%` }}
                />
                <span
                  className={`text-sm font-medium ${
                    count === 0 ? "text-ink-soft" : ""
                  }`}
                >
                  {count}
                  <span className="sr-only">
                    {count === 1 ? " application" : " applications"}
                  </span>
                </span>
              </span>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-7 left-28 z-10 hidden rounded bg-ink px-2 py-1 text-sm whitespace-nowrap text-white group-hover:block"
              >
                <strong>{count}</strong> in {STATUS_LABELS[status]}, {share}% of
                all
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
