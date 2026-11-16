import type { Metadata } from "next";
import { Suspense } from "react";
import { DeleteAccount } from "@/components/DeleteAccount";
import { FreshOnNavigation } from "@/components/FreshOnNavigation";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-4xl font-bold">Account</h1>
      <div className="mt-8">
        <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
          <Account />
        </Suspense>
      </div>
    </div>
  );
}

async function Account() {
  const user = await requireUser();
  return (
    <FreshOnNavigation>
      <p className="text-lg">
        Signed in with GitHub as <strong>{user.name}</strong>.
      </p>
      <h2 className="mt-10 text-2xl font-bold">Delete account</h2>
      <p className="mt-2 mb-4 max-w-[60ch] text-ink-soft">
        This removes your account and everything in it: applications, notes, AI
        results, your CV text and your weekly goal. It cannot be undone.
      </p>
      <DeleteAccount />
    </FreshOnNavigation>
  );
}
