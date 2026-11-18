"use client";

import { useActionState } from "react";
import { saveWeeklyTargetAction } from "@/app/actions";

export function GoalForm({ target, max }: { target: number; max: number }) {
  const [state, formAction, pending] = useActionState(saveWeeklyTargetAction, {
    ok: true,
  });

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="weeklyTarget" className="font-semibold">
          Applications to send per week
        </label>
        <input
          key={target}
          id="weeklyTarget"
          name="weeklyTarget"
          type="number"
          min={1}
          max={max}
          step={1}
          required
          defaultValue={target}
          className="field w-28"
        />
      </div>
      <button type="submit" disabled={pending} className="btn btn-quiet">
        {pending ? "Saving…" : "Save goal"}
      </button>
      <p aria-live="polite" className="pb-2 font-medium">
        {!pending && state.message && (
          <span className={state.ok ? "hl hl-green" : "text-danger"}>
            {state.message}
          </span>
        )}
      </p>
    </form>
  );
}
