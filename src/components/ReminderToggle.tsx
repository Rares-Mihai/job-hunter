"use client";

import { useActionState } from "react";
import { setRemindersAction } from "@/app/actions";

export function ReminderToggle({
  enabled,
  email,
}: {
  enabled: boolean;
  email: string;
}) {
  const [state, formAction, pending] = useActionState(setRemindersAction, {
    ok: true,
  });

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex max-w-[60ch] items-start gap-3">
        <input
          key={String(enabled)}
          type="checkbox"
          name="enabled"
          defaultChecked={enabled}
          className="mt-1.5 size-4"
        />
        <span>
          Email me when a job on my wishlist is 3 days or less from its
          deadline.
          <span className="block text-sm text-ink-soft">
            Sent to {email}, at most once a day.
          </span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-quiet">
          {pending ? "Saving…" : "Save"}
        </button>
        <p aria-live="polite" className="font-medium">
          {!pending && state.message && (
            <span className="hl hl-green">{state.message}</span>
          )}
        </p>
      </div>
    </form>
  );
}
