// Pure helpers for the board. Shared by client code, so no database imports.

import { STATUSES, type Status } from "./status";

type Searchable = { company: string; role: string; location: string | null };

/** True when every word of the query appears in the card's text. */
export function matchesQuery(card: Searchable, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text =
    `${card.company} ${card.role} ${card.location ?? ""}`.toLowerCase();
  return words.every((word) => text.includes(word));
}

export function filterCards<T extends Searchable>(
  cards: T[],
  query: string,
): T[] {
  return cards.filter((card) => matchesQuery(card, query));
}

/** How many cards are in each stage. Every stage is present, even at 0. */
export function countByStatus(
  cards: { status: Status }[],
): Record<Status, number> {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<
    Status,
    number
  >;
  for (const card of cards) counts[card.status] += 1;
  return counts;
}
