"use client";

import { useActionState } from "react";
import { createApplicationAction, importPostingAction } from "@/app/actions";
import {
  ApplicationForm,
  EMPTY_APPLICATION,
  type ApplicationFormValues,
} from "./ApplicationForm";

/** The "Add application" page: import from a link, then review and save. */
export function NewApplication() {
  const [imported, importAction, importing] = useActionState(
    importPostingAction,
    { ok: true },
  );
  const initial = {
    ...EMPTY_APPLICATION,
    ...(imported.ok ? imported.values : undefined),
  } as ApplicationFormValues;

  return (
    <div className="flex flex-col gap-10">
      <form action={importAction} className="flex flex-col gap-1.5">
        <label htmlFor="link" className="font-semibold">
          Import from a link{" "}
          <span className="font-normal text-ink-soft">(optional)</span>
        </label>
        <p id="link-hint" className="max-w-[70ch] text-sm text-ink-soft">
          Paste the address of the job page to fill in the fields below. It
          works on most company career pages; sites that need a login have to be
          copied by hand.
        </p>
        <div className="flex flex-wrap gap-3">
          <input
            id="link"
            name="link"
            type="url"
            required
            placeholder="https://"
            autoComplete="off"
            aria-describedby="link-hint"
            className="field min-w-0 flex-1 basis-80"
          />
          <button type="submit" disabled={importing} className="btn btn-quiet">
            {importing ? "Reading the page…" : "Import"}
          </button>
        </div>
        <p aria-live="polite" className="font-medium">
          {!importing && imported.message && (
            <span className={imported.ok ? "hl hl-green" : "text-danger"}>
              {imported.message}
            </span>
          )}
        </p>
      </form>

      <ApplicationForm
        action={createApplicationAction}
        initial={initial}
        submitLabel="Add application"
        pendingLabel="Adding…"
      />
    </div>
  );
}
