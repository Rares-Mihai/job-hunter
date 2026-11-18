"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-xl py-10">
      <h1 className="text-4xl font-bold">The page could not load</h1>
      <p className="mt-3 text-lg text-ink-soft">
        Something went wrong while loading this page. If it keeps happening,
        check that the database is running and that DATABASE_URL in the .env
        file points to it.
      </p>
      <button type="button" className="btn btn-primary mt-6" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
