"use client";

import { useState, useTransition } from "react";
import { deleteApplicationAction } from "@/app/actions";

/** Delete with a second, explicit confirmation step: it cannot be undone. */
export function DeleteApplication({
  applicationId,
  company,
}: {
  applicationId: string;
  company: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        className="btn btn-danger"
        onClick={() => setConfirming(true)}
      >
        Delete application
      </button>
    );
  }

  return (
    <div role="group" aria-label="Confirm deletion">
      <p className="max-w-[45ch]">
        Delete the application to {company}? Its notes, analysis and history
        will be gone for good.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          className="btn btn-quiet border-danger text-danger"
          disabled={pending}
          onClick={() =>
            startTransition(() => deleteApplicationAction(applicationId))
          }
        >
          {pending ? "Deleting…" : "Delete application"}
        </button>
        <button
          type="button"
          className="btn btn-quiet"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Keep it
        </button>
      </div>
    </div>
  );
}
