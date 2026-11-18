"use client";

import { useActionState } from "react";
import { saveCvAction, uploadCvAction, type FormState } from "@/app/actions";

const START: FormState = { ok: true };

function Status({ state, pending }: { state: FormState; pending: boolean }) {
  return (
    <p aria-live="polite" className="font-medium">
      {!pending && state.message && (
        <span className={state.ok ? "hl hl-green" : "text-danger"}>
          {state.message}
        </span>
      )}
    </p>
  );
}

export function CvForm({
  text,
  fileName,
}: {
  text: string;
  fileName: string | null;
}) {
  const [uploadState, uploadAction, uploading] = useActionState(
    uploadCvAction,
    START,
  );
  const [saveState, saveAction, saving] = useActionState(saveCvAction, START);
  const shownText = saveState.values?.cvText ?? text;

  return (
    <div className="flex flex-col gap-12">
      <form action={uploadAction} className="flex flex-col gap-3">
        <label htmlFor="cvFile" className="font-semibold">
          {fileName ? "Replace the PDF" : "CV as a PDF"}
        </label>
        <p id="cv-file-hint" className="max-w-[70ch] text-sm text-ink-soft">
          {fileName ? `Current file: ${fileName}. ` : "Up to 4 MB. "}
          Only the text is kept; the file itself is not stored. Scanned PDFs do
          not work, because they contain a picture of the text.
        </p>
        <input
          id="cvFile"
          name="cvFile"
          type="file"
          accept="application/pdf,.pdf"
          required
          aria-describedby="cv-file-hint"
          className="field file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-paper file:px-3 file:py-1 file:font-semibold"
        />
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={uploading}
            className="btn btn-primary"
          >
            {uploading ? "Reading the PDF…" : "Upload PDF"}
          </button>
          <Status state={uploadState} pending={uploading} />
        </div>
      </form>

      <form action={saveAction} className="flex flex-col gap-3">
        <label htmlFor="cvText" className="font-semibold">
          {fileName ? "Text read from your CV" : "Or type or paste the text"}
        </label>
        <p id="cv-hint" className="max-w-[70ch] text-sm text-ink-soft">
          This is exactly what the AI sees. Fix anything that came out wrong.
          Changing it clears earlier match scores, because they were based on
          the old text.
        </p>
        <textarea
          // Start over when the saved text changes; see ApplicationForm.
          key={shownText}
          id="cvText"
          name="cvText"
          rows={18}
          defaultValue={shownText}
          aria-describedby="cv-hint"
          className="field"
        />
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={saving} className="btn btn-quiet">
            {saving ? "Saving…" : "Save text"}
          </button>
          <Status state={saveState} pending={saving} />
        </div>
      </form>
    </div>
  );
}
