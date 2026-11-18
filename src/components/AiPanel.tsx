"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  analyzeJobAction,
  draftCoverLetterAction,
  matchCvAction,
  prepareInterviewAction,
  type ActionResult,
} from "@/app/actions";
import type { CvMatch, InterviewPrep, JobAnalysis } from "@/lib/ai/schemas";

const SENIORITY_LABELS: Record<JobAnalysis["seniority"], string | null> = {
  internship: "Internship",
  junior: "Junior",
  mid: "Mid-level",
  senior: "Senior",
  unspecified: null,
};

type Props = {
  applicationId: string;
  aiConfigured: boolean;
  hasPosting: boolean;
  hasCv: boolean;
  analysis: JobAnalysis | null;
  match: CvMatch | null;
  coverLetter: string | null;
  interviewPrep: InterviewPrep | null;
};

type Task = "analysis" | "match" | "letter" | "prep";

export function AiPanel({
  applicationId,
  aiConfigured,
  hasPosting,
  hasCv,
  analysis,
  match,
  coverLetter,
  interviewPrep,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<Task | null>(null);
  // Which result was produced just now, so it can be "highlighted in" once.
  const [fresh, setFresh] = useState<Task | null>(null);
  const [error, setError] = useState<{ task: Task; message: string } | null>(
    null,
  );

  function run(task: Task, action: (id: string) => Promise<ActionResult>) {
    setRunning(task);
    setError(null);
    setFresh(null);
    startTransition(async () => {
      const result = await action(applicationId);
      if (result.ok) setFresh(task);
      else setError({ task, message: result.message });
      setRunning(null);
    });
  }

  if (!aiConfigured) {
    return (
      <section aria-labelledby="ai-heading">
        <h2 id="ai-heading" className="text-2xl font-bold">
          Posting analysis
        </h2>
        <p className="mt-3 max-w-[55ch] text-ink-soft">
          AI is not set up yet. Add a Claude API key as{" "}
          <code className="text-ink">ANTHROPIC_API_KEY</code> in the{" "}
          <code className="text-ink">.env</code> file and restart the app. Then
          it can list what this job asks for and compare it with your CV.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="analysis-heading">
        <h2 id="analysis-heading" className="text-2xl font-bold">
          Posting analysis
        </h2>

        {!hasPosting && (
          <p className="mt-3 max-w-[55ch] text-ink-soft">
            Paste the job posting into the form and save it. Then the AI can
            list what the job asks for.
          </p>
        )}

        {analysis && (
          <AnalysisResult analysis={analysis} draw={fresh === "analysis"} />
        )}

        {hasPosting && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={analysis ? "btn btn-quiet" : "btn btn-primary"}
              disabled={pending}
              onClick={() => run("analysis", analyzeJobAction)}
            >
              {running === "analysis"
                ? "Reading the posting…"
                : analysis
                  ? "Analyze again"
                  : "Analyze posting"}
            </button>
            {error?.task === "analysis" && (
              <p role="alert" className="font-medium text-danger">
                {error.message}
              </p>
            )}
          </div>
        )}
      </section>

      {hasPosting && (
        <section aria-labelledby="match-heading">
          <h2 id="match-heading" className="text-2xl font-bold">
            CV match
          </h2>

          {!hasCv && (
            <p className="mt-3 max-w-[55ch] text-ink-soft">
              <Link href="/cv" className="link">
                Add your CV
              </Link>{" "}
              to see how well it fits this job and what to emphasize.
            </p>
          )}

          {match && <MatchResult match={match} draw={fresh === "match"} />}

          {hasCv && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={match ? "btn btn-quiet" : "btn btn-primary"}
                disabled={pending}
                onClick={() => run("match", matchCvAction)}
              >
                {running === "match"
                  ? "Comparing with your CV…"
                  : match
                    ? "Compare again"
                    : "Compare with my CV"}
              </button>
              {error?.task === "match" && (
                <p role="alert" className="font-medium text-danger">
                  {error.message}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {hasPosting && hasCv && (
        <section aria-labelledby="letter-heading">
          <h2 id="letter-heading" className="text-2xl font-bold">
            Cover letter draft
          </h2>
          {!coverLetter && (
            <p className="mt-3 max-w-[55ch] text-ink-soft">
              A first draft built only from what your CV says. Edit it before
              you send it.
            </p>
          )}
          {coverLetter && <CoverLetter text={coverLetter} />}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={coverLetter ? "btn btn-quiet" : "btn btn-primary"}
              disabled={pending}
              onClick={() => run("letter", draftCoverLetterAction)}
            >
              {running === "letter"
                ? "Writing the draft…"
                : coverLetter
                  ? "Write another draft"
                  : "Draft a cover letter"}
            </button>
            {error?.task === "letter" && (
              <p role="alert" className="font-medium text-danger">
                {error.message}
              </p>
            )}
          </div>
        </section>
      )}

      {hasPosting && hasCv && (
        <section aria-labelledby="prep-heading">
          <h2 id="prep-heading" className="text-2xl font-bold">
            Interview prep
          </h2>
          {!interviewPrep && (
            <p className="mt-3 max-w-[55ch] text-ink-soft">
              Questions you are likely to get for this job, with a pointer for
              each one.
            </p>
          )}
          {interviewPrep && (
            <ol className="mt-3 flex max-w-[60ch] list-decimal flex-col gap-4 pl-5 marker:font-semibold">
              {interviewPrep.questions.map((item, index) => (
                <li key={`${item.question}-${index}`}>
                  <p className="font-semibold">{item.question}</p>
                  <p className="mt-1 text-ink-soft">{item.why}</p>
                  <p className="mt-1">{item.tip}</p>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={interviewPrep ? "btn btn-quiet" : "btn btn-primary"}
              disabled={pending}
              onClick={() => run("prep", prepareInterviewAction)}
            >
              {running === "prep"
                ? "Preparing questions…"
                : interviewPrep
                  ? "Prepare again"
                  : "Prepare for the interview"}
            </button>
            {error?.task === "prep" && (
              <p role="alert" className="font-medium text-danger">
                {error.message}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function CoverLetter({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="max-w-[60ch] rounded-md border border-line bg-surface px-4 py-3 whitespace-pre-wrap">
        {text}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button type="button" className="btn btn-quiet" onClick={copy}>
          Copy text
        </button>
        <p aria-live="polite" className="font-medium">
          {copied && <span className="hl hl-green">Copied</span>}
        </p>
      </div>
    </div>
  );
}

export function AnalysisResult({
  analysis,
  draw,
}: {
  analysis: JobAnalysis;
  draw: boolean;
}) {
  const required = analysis.requirements.filter((r) => r.importance === "must");
  const niceToHave = analysis.requirements.filter(
    (r) => r.importance === "nice",
  );
  const level = SENIORITY_LABELS[analysis.seniority];

  return (
    <div className="mt-3 flex flex-col gap-5">
      <p className="max-w-[60ch]">
        {analysis.summary}
        {level && <span className="text-ink-soft"> Level: {level}.</span>}
      </p>
      <SkillList
        title="Required"
        skills={required.map((r) => r.skill)}
        highlight="hl-yellow"
        draw={draw}
      />
      <SkillList
        title="Nice to have"
        skills={niceToHave.map((r) => r.skill)}
        highlight="hl-blue"
        draw={draw}
      />
      <TextList title="What you would do" items={analysis.responsibilities} />
    </div>
  );
}

export function MatchResult({
  match,
  draw,
}: {
  match: CvMatch;
  draw: boolean;
}) {
  return (
    <div className="mt-3 flex flex-col gap-5">
      <div className="flex items-end gap-4">
        <p className="text-6xl leading-none font-semibold">
          {match.score}
          <span className="sr-only"> out of 100</span>
        </p>
        <p className="max-w-[45ch] pb-1 text-ink-soft" aria-hidden="true">
          out of 100
        </p>
      </div>
      <p className="max-w-[60ch]">{match.verdict}</p>
      <SkillList
        title="Your CV already shows"
        skills={match.matchedSkills}
        highlight="hl-green"
        draw={draw}
      />
      <SkillList
        title="Missing from your CV"
        skills={match.missingSkills}
        highlight="hl-pink"
        draw={draw}
      />
      <TextList title="Emphasize" items={match.highlights} />
      <TextList title="Ways to improve" items={match.suggestions} />
    </div>
  );
}

function SkillList({
  title,
  skills,
  highlight,
  draw,
}: {
  title: string;
  skills: string[];
  highlight: string;
  draw: boolean;
}) {
  if (skills.length === 0) return null;
  return (
    <div>
      <h3 className="font-sans text-base font-semibold tracking-normal">
        {title}
      </h3>
      <ul className="mt-2 flex flex-wrap gap-x-2 gap-y-2.5">
        {skills.map((skill, index) => (
          <li key={`${skill}-${index}`}>
            <span
              className={`hl ${highlight} ${draw ? "hl-draw" : ""}`}
              style={{ "--i": index } as React.CSSProperties}
            >
              {skill}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TextList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="font-sans text-base font-semibold tracking-normal">
        {title}
      </h3>
      <ul className="mt-2 flex max-w-[60ch] list-disc flex-col gap-1 pl-5 marker:text-ink-soft">
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
