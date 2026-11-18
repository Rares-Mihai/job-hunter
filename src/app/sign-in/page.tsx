import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { signInWithGitHubAction } from "@/app/actions";
import { isSignInConfigured } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage(props: PageProps<"/sign-in">) {
  return (
    <div className="max-w-xl py-10">
      <h1 className="text-5xl font-bold">Every application, one board.</h1>
      <p className="mt-4 max-w-[52ch] text-lg text-ink-soft">
        Track the jobs you apply for, let AI pull the requirements out of a
        posting, and see how your CV measures up before you send it.
      </p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
          <SignIn searchParams={props.searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function SignIn({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Decide per request, not at build time, whether sign-in is set up.
  await connection();
  if (!isSignInConfigured()) {
    return (
      <p className="max-w-[60ch]">
        Sign-in is not set up yet. Add <code>BETTER_AUTH_SECRET</code>,{" "}
        <code>GITHUB_CLIENT_ID</code> and <code>GITHUB_CLIENT_SECRET</code> to
        the <code>.env</code> file (the README explains where they come from)
        and restart the app.
      </p>
    );
  }

  if (await getCurrentUser()) redirect("/");
  const failed = (await searchParams).error !== undefined;

  return (
    <form action={signInWithGitHubAction}>
      {failed && (
        <p role="alert" className="mb-4 font-medium text-danger">
          Signing in did not finish. Try again, and approve the request on
          GitHub when it asks.
        </p>
      )}
      <button type="submit" className="btn btn-primary">
        Sign in with GitHub
      </button>
      <p className="mt-4 max-w-[52ch] text-sm text-ink-soft">
        GitHub only shares your name, email and profile picture. Your
        applications and CV are visible to you alone.
      </p>
    </form>
  );
}
