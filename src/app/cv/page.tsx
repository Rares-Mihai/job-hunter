import type { Metadata } from "next";
import { Suspense } from "react";
import { CvForm } from "@/components/CvForm";
import { FreshOnNavigation } from "@/components/FreshOnNavigation";
import { getCv } from "@/lib/applications";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "CV" };

export default function CvPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-4xl font-bold">Your CV</h1>
      <p className="mt-3 max-w-[60ch] text-lg text-ink-soft">
        Upload your CV as a PDF. Its text is compared with each job posting to
        show which requirements you already cover and which are missing.
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
  const user = await requireUser();
  const cv = await getCv(user.id);
  return (
    <FreshOnNavigation>
      <CvForm text={cv.text} fileName={cv.fileName} />
    </FreshOnNavigation>
  );
}
