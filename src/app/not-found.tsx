import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-xl py-10">
      <h1 className="text-4xl font-bold">Page not found</h1>
      <p className="mt-3 text-lg text-ink-soft">
        This page does not exist. If you followed a link to an application, it
        may have been deleted.
      </p>
      <Link href="/" className="btn btn-primary mt-6">
        Go to the board
      </Link>
    </div>
  );
}
