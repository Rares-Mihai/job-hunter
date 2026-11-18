"use client";

import { useRouter } from "next/navigation";
import { Fragment } from "react";

/**
 * Next.js keeps a page's state alive (hidden) after you navigate away from
 * it. That is right for the browser's Back button, but wrong when you open a
 * page again through a link: a form would still show what you typed last
 * time, or an old "Saved" message.
 *
 * Wrapping page content in this gives it a fresh start on every new
 * navigation, while Back and Forward still restore it as it was.
 */
export function FreshOnNavigation({ children }: { children: React.ReactNode }) {
  const { bfcacheId } = useRouter();
  return <Fragment key={bfcacheId}>{children}</Fragment>;
}
