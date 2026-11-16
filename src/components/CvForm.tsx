"use client";

import { useActionState } from "react";
import { saveCvAction } from "@/app/actions";

export function CvForm({ initial }: { initial: string }) {
  const [state, formAction, pending] = useActionState(saveCvAction, {
    ok: true,
  });

  const text = state.values?.cvText ?? initial;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label htmlFor="cvText" className="font-semibold">
        CV text
      </label>
      <textarea
        // Start over when the saved text changes; see ApplicationForm.
        key={text}
        id="cvText"
        name="cvText"
        rows={22}
        defaultValue={text}
        aria-describedby="cv-hint"
        className="field"
      />
      <p id="cv-hint" className="max-w-[70ch] text-sm text-ink-soft">
        Saving a changed CV clears earlier match scores, because they were based
        on the old text. Run the comparison again on the applications you care
        about.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Saving…" : "Save CV"}
        </button>
        <p aria-live="polite" className="font-medium">
          {!pending && state.message && (
            <span className={state.ok ? "hl hl-green" : "text-danger"}>
              {state.message}
            </span>
          )}
        </p>
      </div>
    </form>
  );
}
