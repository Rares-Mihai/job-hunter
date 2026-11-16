// The stages an application moves through. Shared by server and client code,
// so this file must not import anything database-related.

export const STATUSES = [
  "wishlist",
  "applied",
  "interview",
  "offer",
  "rejected",
] as const;

export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  wishlist: "Wishlist",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && STATUSES.includes(value as Status);
}

/** An application counts as "sent" once it has left the wishlist. */
export function isSent(status: Status): boolean {
  return status !== "wishlist";
}
