import Link from "next/link";
import { Suspense } from "react";
import { Board, type BoardCard } from "@/components/Board";
import { FreshOnNavigation } from "@/components/FreshOnNavigation";
import { WeekGoal } from "@/components/WeekGoal";
import {
  getWeeklyTarget,
  listAllStatusChanges,
  listApplications,
} from "@/lib/applications";
import { computeStats } from "@/lib/stats";
import { describeDeadline } from "@/lib/dates";
import { followUpNudge } from "@/lib/follow-up";
import { requireUser } from "@/lib/session";

export default function BoardPage() {
  return (
    <>
      <h1 className="sr-only">Application board</h1>
      <Suspense fallback={<p className="text-ink-soft">Loading your board…</p>}>
        <BoardData />
      </Suspense>
    </>
  );
}

async function BoardData() {
  const user = await requireUser();
  const applications = await listApplications(user.id);

  if (applications.length === 0) {
    return (
      <div className="max-w-xl py-10">
        <h2 className="text-3xl font-bold">No applications yet</h2>
        <p className="mt-3 text-lg text-ink-soft">
          Add the first job you are interested in. It starts on your wishlist,
          and you drag it across the board as things move.
        </p>
        <Link href="/applications/new" className="btn btn-primary mt-6">
          Add application
        </Link>
      </div>
    );
  }

  const now = new Date();
  const [changes, target] = await Promise.all([
    listAllStatusChanges(user.id),
    getWeeklyTarget(user.id),
  ]);
  const stats = computeStats(applications, changes, now);
  const changesByApp = new Map<string, typeof changes>();
  for (const change of changes) {
    const list = changesByApp.get(change.applicationId);
    if (list) list.push(change);
    else changesByApp.set(change.applicationId, [change]);
  }
  const cards: BoardCard[] = applications.map((application) => ({
    id: application.id,
    company: application.company,
    role: application.role,
    location: application.location,
    status: application.status,
    // The deadline is the last day to apply, so it only matters while the
    // job is still on the wishlist.
    deadline:
      application.status === "wishlist" && application.deadline
        ? describeDeadline(application.deadline, now)
        : null,
    followUp: followUpNudge(
      application.status,
      changesByApp.get(application.id) ?? [],
      now,
      application.createdAt,
    ),
    matchScore: application.match?.score ?? null,
  }));

  return (
    <>
      <WeekGoal
        sent={stats.sentThisWeek}
        target={target}
        streakWeeks={stats.streakWeeks}
      />
      <FreshOnNavigation>
        <Board cards={cards} />
      </FreshOnNavigation>
    </>
  );
}
