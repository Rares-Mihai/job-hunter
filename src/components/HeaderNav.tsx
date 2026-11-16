import Link from "next/link";
import { signOutAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/session";
import { NavLinks } from "./NavLinks";

/** The part of the header that only signed-in users get. */
export async function HeaderNav() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <>
      <NavLinks />
      <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/applications/new" className="btn btn-primary">
          Add application
        </Link>
        <form action={signOutAction} className="flex items-center gap-3">
          <span className="text-sm text-ink-soft">{user.name}</span>
          <button type="submit" className="btn btn-quiet">
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}
