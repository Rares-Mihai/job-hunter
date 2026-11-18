import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CvForm } from "@/components/CvForm";
import { FreshOnNavigation } from "@/components/FreshOnNavigation";
import { getCv } from "@/lib/applications";

export const metadata: Metadata = { title: "CV" };

export default function CvPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-4xl font-bold">Your CV</h1>
      <p className="mt-3 max-w-[60ch] text-lg text-ink-soft">
        Paste the text of your CV here once. It is compared with each job
        posting to show which requirements you already cover and which are
        missing.
      </p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-ink-soft">Loading your CV…</p>}>
          <CvData />
        </Suspense>
      </div>
    </div>
  );
}

async function CvData() {
  await connection();
  const cv = await getCv();
  return (
    <FreshOnNavigation>
      <CvForm initial={cv} />
    </FreshOnNavigation>
  );
}
