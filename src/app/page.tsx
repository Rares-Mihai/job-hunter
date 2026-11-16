import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Board, type BoardCard } from "@/components/Board";
import { FreshOnNavigation } from "@/components/FreshOnNavigation";
import { listApplications } from "@/lib/applications";
import { describeDeadline } from "@/lib/dates";

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
  // Always render with fresh data, never at build time.
  await connection();
  const applications = await listApplications();

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
    matchScore: application.match?.score ?? null,
  }));

  return (
    <FreshOnNavigation>
      <Board cards={cards} />
    </FreshOnNavigation>
  );
}
