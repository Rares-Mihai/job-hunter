"use client";

import { useState, useTransition } from "react";
import { deleteAccountAction } from "@/app/actions";

const CONFIRM_WORD = "delete";

/** Deleting everything asks for a typed word, not just a second click. */
export function DeleteAccount() {
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  const confirmed = typed.trim().toLowerCase() === CONFIRM_WORD;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (confirmed) startTransition(() => deleteAccountAction());
      }}
    >
      <label htmlFor="confirm-delete" className="font-semibold">
        Type “{CONFIRM_WORD}” to confirm
      </label>
      <input
        id="confirm-delete"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        autoComplete="off"
        className="field w-48"
      />
      <div>
        <button
          type="submit"
          disabled={!confirmed || pending}
          className="btn btn-quiet border-danger text-danger disabled:cursor-not-allowed"
        >
          {pending ? "Deleting…" : "Delete my account and data"}
        </button>
      </div>
    </form>
  );
}
