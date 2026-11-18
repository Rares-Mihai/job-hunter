"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Board" },
  { href: "/stats", label: "Stats" },
  { href: "/cv", label: "CV" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex gap-1">
      {LINKS.map((link) => {
        const current =
          link.href === "/"
            ? pathname === "/" || pathname.startsWith("/applications")
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 font-medium ${
              current
                ? "bg-paper text-ink"
                : "text-ink-soft hover:bg-paper hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
