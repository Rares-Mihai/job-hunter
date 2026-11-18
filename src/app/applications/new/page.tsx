import type { Metadata } from "next";
import { Suspense } from "react";
import { createApplicationAction } from "@/app/actions";
import { requireUser } from "@/lib/session";
import { FreshOnNavigation } from "@/components/FreshOnNavigation";
import {
  ApplicationForm,
  EMPTY_APPLICATION,
} from "@/components/ApplicationForm";

export const metadata: Metadata = { title: "Add application" };

export default function NewApplicationPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-4xl font-bold">Add application</h1>
      <p className="mt-3 max-w-[60ch] text-lg text-ink-soft">
        Only the company and the role are needed. You can paste the posting and
        fill in the rest later.
      </p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
          <NewApplicationForm />
        </Suspense>
      </div>
    </div>
  );
}

async function NewApplicationForm() {
  // Only signed-in users get the form; everyone else goes to the sign-in page.
  await requireUser();
  return (
    <FreshOnNavigation>
      <ApplicationForm
        action={createApplicationAction}
        initial={EMPTY_APPLICATION}
        submitLabel="Add application"
        pendingLabel="Adding…"
      />
    </FreshOnNavigation>
  );
}
