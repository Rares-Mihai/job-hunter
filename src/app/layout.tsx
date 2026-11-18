import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NavLinks } from "@/components/NavLinks";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Job Hunter",
    template: "%s | Job Hunter",
  },
  description:
    "Track every job application on one board, and let AI read the posting and compare it with your CV.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-x-8 gap-y-2 px-5 py-3">
            <Link
              href="/"
              className="font-display text-xl font-extrabold tracking-tight"
            >
              Job Hunter
            </Link>
            <Suspense>
              <NavLinks />
            </Suspense>
            <Link href="/applications/new" className="btn btn-primary ml-auto">
              Add application
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] min-w-0 flex-1 px-5 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
