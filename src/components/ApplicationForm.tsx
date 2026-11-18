"use client";

import { useActionState, useId } from "react";
import type { FormState } from "@/app/actions";
import { STATUS_LABELS, STATUSES, type Status } from "@/lib/status";
import type { FieldErrors } from "@/lib/validation";

export type ApplicationFormValues = {
  company: string;
  role: string;
  url: string;
  location: string;
  status: Status;
  deadline: string;
  notes: string;
  jobDescription: string;
};

export const EMPTY_APPLICATION: ApplicationFormValues = {
  company: "",
  role: "",
  url: "",
  location: "",
  status: "wishlist",
  deadline: "",
  notes: "",
  jobDescription: "",
};

type Props = {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  initial: ApplicationFormValues;
  submitLabel: string;
  pendingLabel: string;
};

export function ApplicationForm({
  action,
  initial,
  submitLabel,
  pendingLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(action, { ok: true });
  // After a failed save, start from what the user typed, not the old values.
  const values = { ...initial, ...state.values } as FieldValues;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {/*
        The fields are uncontrolled (the browser holds what is typed). The key
        makes them start over whenever the values they should start from
        change: after a save, or when the stage was changed on the board.
      */}
      <Fields
        key={JSON.stringify(values)}
        values={values}
        errors={state.errors ?? {}}
      />

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? pendingLabel : submitLabel}
        </button>
        <p aria-live="polite" className="font-medium">
          {!pending && state.message && (
            <span className={state.ok ? "hl hl-green" : "text-danger"}>
              {state.message}
            </span>
          )}
          {!pending && !state.ok && state.errors && (
            <span className="text-danger">
              Fix the fields marked in red and try again.
            </span>
          )}
        </p>
      </div>
    </form>
  );
}

type FieldValues = Record<keyof ApplicationFormValues, string>;

function Fields({
  values,
  errors,
}: {
  values: FieldValues;
  errors: FieldErrors;
}) {
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Company" name="company" error={errors.company}>
          {(props) => (
            <input
              {...props}
              type="text"
              defaultValue={values.company}
              required
              autoComplete="off"
              className="field"
            />
          )}
        </Field>
        <Field label="Role" name="role" error={errors.role}>
          {(props) => (
            <input
              {...props}
              type="text"
              defaultValue={values.role}
              required
              autoComplete="off"
              className="field"
            />
          )}
        </Field>
        <Field
          label="Link to the posting"
          name="url"
          optional
          error={errors.url}
        >
          {(props) => (
            <input
              {...props}
              type="url"
              defaultValue={values.url}
              placeholder="https://"
              autoComplete="off"
              className="field"
            />
          )}
        </Field>
        <Field
          label="Location"
          name="location"
          optional
          error={errors.location}
        >
          {(props) => (
            <input
              {...props}
              type="text"
              defaultValue={values.location}
              autoComplete="off"
              className="field"
            />
          )}
        </Field>
        <Field label="Stage" name="status" error={errors.status}>
          {(props) => (
            <select {...props} defaultValue={values.status} className="field">
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field
          label="Apply by"
          name="deadline"
          optional
          error={errors.deadline}
        >
          {(props) => (
            <input
              {...props}
              type="date"
              defaultValue={values.deadline}
              className="field"
            />
          )}
        </Field>
      </div>

      <Field
        label="Job posting"
        name="jobDescription"
        optional
        hint="Paste the full text of the posting. The AI reads this to list the requirements and compare them with your CV."
        error={errors.jobDescription}
      >
        {(props) => (
          <textarea
            {...props}
            defaultValue={values.jobDescription}
            rows={10}
            className="field"
          />
        )}
      </Field>

      <Field label="Notes" name="notes" optional error={errors.notes}>
        {(props) => (
          <textarea
            {...props}
            defaultValue={values.notes}
            rows={4}
            className="field"
          />
        )}
      </Field>
    </>
  );
}

type FieldRenderProps = {
  id: string;
  name: string;
  "aria-invalid": boolean | undefined;
  "aria-describedby": string | undefined;
};

function Field({
  label,
  name,
  optional = false,
  hint,
  error,
  children,
}: {
  label: string;
  name: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: (props: FieldRenderProps) => React.ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold">
        {label}
        {optional && (
          <span className="font-normal text-ink-soft"> (optional)</span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="max-w-[70ch] text-sm text-ink-soft">
          {hint}
        </p>
      )}
      {children({
        id,
        name,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
