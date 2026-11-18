import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuth, isSignInConfigured } from "./auth";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

/**
 * The signed-in user, or null. The session is checked against the database
 * on every request; `cache` only avoids repeating that check when several
 * components ask during the same request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Read the request first, even when sign-in is not set up. It marks this as
  // per-visitor work, so the answer is never worked out once at build time
  // (when no settings exist) and then served to everyone.
  const requestHeaders = await headers();
  if (!isSignInConfigured()) return null;
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
  };
});

/**
 * The signed-in user. Sends the visitor to the sign-in page when there is
 * none, so code after this call can rely on having an owner for the data.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}
