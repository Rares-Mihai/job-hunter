import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { updateApplicationAction } from "@/app/actions";
import { AiPanel } from "@/components/AiPanel";
import { ApplicationForm } from "@/components/ApplicationForm";
import { DeleteApplication } from "@/components/DeleteApplication";
import { FreshOnNavigation } from "@/components/FreshOnNavigation";
import { isAiConfigured } from "@/lib/ai/client";
import { getApplication, getCv, listStatusHistory } from "@/lib/applications";
import { formatDay } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { STATUS_LABELS } from "@/lib/status";

export const metadata: Metadata = { title: "Application" };

export default function ApplicationPage(
  props: PageProps<"/applications/[id]">,
) {
  return (
    <Suspense fallback={<p className="text-ink-soft">Loading application…</p>}>
      <ApplicationDetail params={props.params} />
    </Suspense>
  );
}

async function ApplicationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const application = await getApplication(user.id, id);
  if (!application) notFound();

  const [history, cv] = await Promise.all([
    listStatusHistory(user.id, id),
    getCv(user.id),
  ]);

  return (
    <FreshOnNavigation>
      <p>
        <Link href="/" className="link">
          Back to the board
        </Link>
      </p>
      <h1 className="mt-4 text-4xl font-bold">{application.company}</h1>
      <p className="mt-2 text-xl text-ink-soft">
        {application.role}
        {application.location ? `, ${application.location}` : ""}
      </p>
      {application.url && (
        <p className="mt-2">
          <a
            href={application.url}
            target="_blank"
            rel="noopener noreferrer"
            className="link"
          >
            Open the posting
          </a>
        </p>
      )}

      <div className="mt-10 grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div>
          <ApplicationForm
            action={updateApplicationAction.bind(null, application.id)}
            initial={{
              company: application.company,
              role: application.role,
              url: application.url ?? "",
              location: application.location ?? "",
              status: application.status,
              deadline: application.deadline ?? "",
              notes: application.notes,
              jobDescription: application.jobDescription,
            }}
            submitLabel="Save changes"
            pendingLabel="Saving…"
          />
          <div className="mt-10 border-t border-line pt-6">
            <DeleteApplication
              applicationId={application.id}
              company={application.company}
            />
          </div>
        </div>

        <div className="flex flex-col gap-10">
          <AiPanel
            applicationId={application.id}
            aiConfigured={isAiConfigured()}
            hasPosting={application.jobDescription.trim() !== ""}
            hasCv={cv.text.trim() !== ""}
            analysis={application.analysis}
            match={application.match}
          />

          <section aria-labelledby="history-heading">
            <h2 id="history-heading" className="text-2xl font-bold">
              History
            </h2>
            <ol className="mt-3 flex flex-col gap-1.5">
              {history.map((change) => (
                <li
                  key={change.id}
                  className="flex justify-between gap-4 border-b border-line pb-1.5"
                >
                  <span>
                    {change.fromStatus
                      ? `Moved from ${STATUS_LABELS[change.fromStatus]} to ${STATUS_LABELS[change.toStatus]}`
                      : `Added to ${STATUS_LABELS[change.toStatus]}`}
                  </span>
                  <time
                    dateTime={change.changedAt.toISOString()}
                    className="shrink-0 text-ink-soft"
                  >
                    {formatDay(change.changedAt)}
                  </time>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </FreshOnNavigation>
  );
}
