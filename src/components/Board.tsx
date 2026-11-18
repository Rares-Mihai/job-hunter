"use client";

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useId, useOptimistic, useState, useTransition } from "react";
import { moveApplicationAction } from "@/app/actions";
import type { DeadlineInfo } from "@/lib/dates";
import { isStatus, STATUS_LABELS, STATUSES, type Status } from "@/lib/status";

export type BoardCard = {
  id: string;
  company: string;
  role: string;
  location: string | null;
  status: Status;
  deadline: DeadlineInfo | null;
  matchScore: number | null;
};

const STATUS_HIGHLIGHT: Record<Status, string> = {
  wishlist: "hl-blue",
  applied: "hl-yellow",
  interview: "hl-pink",
  offer: "hl-green",
  rejected: "hl-none",
};

const EMPTY_HINT: Record<Status, string> = {
  wishlist: "Jobs you want to apply for.",
  applied: "Drag a card here once you have applied.",
  interview: "Drag a card here when they invite you.",
  offer: "Drag a card here when you get an offer.",
  rejected: "Drag a card here if it does not work out.",
};

export function Board({
  cards,
  demo = false,
}: {
  cards: BoardCard[];
  /** Demo boards keep moves in the browser and have nothing to open. */
  demo?: boolean;
}) {
  const [demoCards, setDemoCards] = useState(cards);
  const sourceCards = demo ? demoCards : cards;
  // Show the card in its new column immediately, before the server confirms.
  const [shownCards, moveOptimistically] = useOptimistic(
    sourceCards,
    (current, move: { id: string; status: Status }) =>
      current.map((card) =>
        card.id === move.id ? { ...card, status: move.status } : card,
      ),
  );
  const [, startTransition] = useTransition();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Changes on every move into Offer, which replays the celebration.
  const [celebration, setCelebration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const dndId = useId();

  const sensors = useSensors(
    // A small distance so that a plain click still opens the card.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Press and hold on touch screens, so swiping still scrolls the board.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    setDraggedId(String(event.active.id));
    setError(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggedId(null);
    const target = event.over?.id;
    const id = String(event.active.id);
    if (!isStatus(target)) return;

    const card = shownCards.find((c) => c.id === id);
    if (!card || card.status === target) return;

    if (target === "offer") setCelebration((count) => count + 1);

    if (demo) {
      setDemoCards((current) =>
        current.map((c) => (c.id === id ? { ...c, status: target } : c)),
      );
      return;
    }

    startTransition(async () => {
      moveOptimistically({ id, status: target });
      const result = await moveApplicationAction(id, target);
      if (!result.ok) setError(result.message);
    });
  }

  const draggedCard = shownCards.find((card) => card.id === draggedId) ?? null;

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const visibleCards =
    words.length === 0
      ? shownCards
      : shownCards.filter((card) => {
          const text =
            `${card.company} ${card.role} ${card.location ?? ""}`.toLowerCase();
          return words.every((word) => text.includes(word));
        });

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggedId(null)}
    >
      {error && (
        <p role="alert" className="mb-4 font-medium text-danger">
          {error}
        </p>
      )}
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <label htmlFor="board-filter" className="font-semibold">
          Find
        </label>
        <input
          id="board-filter"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Company, role or place"
          autoComplete="off"
          className="field w-72 max-w-full"
        />
        <p aria-live="polite" className="text-ink-soft">
          {words.length > 0 &&
            `${visibleCards.length} of ${shownCards.length} shown`}
        </p>
      </div>
      {celebration > 0 && <Celebration key={celebration} />}
      <div className="-mx-5 overflow-x-auto px-5 pb-4">
        <div className="grid min-w-[1100px] grid-cols-5 gap-5">
          {STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              cards={visibleCards.filter((card) => card.status === status)}
              filtering={words.length > 0}
              draggedId={draggedId}
              linked={!demo}
            />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {draggedCard && (
          <div className="rotate-1 cursor-grabbing shadow-[0_10px_24px_-8px_rgb(23_32_61/0.45)]">
            <CardBody card={draggedCard} asLink={false} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  cards,
  draggedId,
  linked,
  filtering,
}: {
  status: Status;
  cards: BoardCard[];
  filtering: boolean;
  draggedId: string | null;
  linked: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const headingId = `column-${status}`;

  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col">
      <h2
        id={headingId}
        className="flex items-baseline gap-2 text-[1.35rem] font-bold"
      >
        {STATUS_LABELS[status]}
        <span className="font-sans text-base font-medium text-ink-soft">
          <span className="sr-only">, </span>
          {cards.length}
          <span className="sr-only">
            {cards.length === 1 ? " application" : " applications"}
          </span>
        </span>
      </h2>
      <div
        aria-hidden="true"
        className={`marker-line mt-1.5 ${STATUS_HIGHLIGHT[status]}`}
      />
      <div
        ref={setNodeRef}
        className={`mt-4 flex min-h-48 flex-1 flex-col gap-2.5 rounded-lg p-1.5 outline-2 outline-dashed -outline-offset-2 ${
          isOver ? "bg-surface outline-pen" : "outline-transparent"
        }`}
      >
        {cards.length === 0 && (
          <p className="px-1.5 pt-1 text-sm text-ink-soft">
            {filtering ? "No matches here." : EMPTY_HINT[status]}
          </p>
        )}
        {cards.map((card) => (
          <DraggableCard
            key={card.id}
            card={card}
            hidden={card.id === draggedId}
            linked={linked}
          />
        ))}
      </div>
    </section>
  );
}

function DraggableCard({
  card,
  hidden,
  linked,
}: {
  card: BoardCard;
  hidden: boolean;
  linked: boolean;
}) {
  // Only the pointer listeners are attached. Keyboard and screen-reader users
  // change the stage with the "Stage" field on the application page instead.
  const { setNodeRef, listeners } = useDraggable({ id: card.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      className={`cursor-grab touch-manipulation select-none ${
        hidden ? "opacity-30" : ""
      }`}
    >
      <CardBody card={card} asLink={linked} />
    </div>
  );
}

function CardBody({ card, asLink }: { card: BoardCard; asLink: boolean }) {
  // The deadline is the last day to apply, so it stops mattering once the
  // card has left the wishlist (including right after a drag).
  const deadline = card.status === "wishlist" ? card.deadline : null;
  return (
    <article className="relative rounded-md border border-line bg-surface px-3.5 py-3 hover:border-ink-soft">
      <h3 className="text-[1.05rem] font-bold">
        {asLink ? (
          // The ::after stretches the link over the whole card.
          <Link
            href={`/applications/${card.id}`}
            draggable={false}
            className="after:absolute after:inset-0 after:rounded-md"
          >
            {card.company}
          </Link>
        ) : (
          card.company
        )}
      </h3>
      <p className="mt-0.5 text-[0.925rem] leading-snug text-ink-soft">
        {card.role}
        {card.location ? `, ${card.location}` : ""}
      </p>
      {(deadline || card.matchScore !== null) && (
        <p className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
          {deadline && (
            <span
              className={
                deadline.tone === "later"
                  ? "text-ink-soft"
                  : "hl hl-pink font-medium"
              }
            >
              {deadline.label}
            </span>
          )}
          {card.matchScore !== null && (
            <span className="ml-auto font-medium">
              {card.matchScore}% CV match
            </span>
          )}
        </p>
      )}
    </article>
  );
}

const CONFETTI_COLORS = ["hl-yellow", "hl-green", "hl-pink", "hl-blue"];

/** A short burst of highlighter-coloured confetti for a new offer. */
function Celebration() {
  return (
    <>
      <p role="status" className="sr-only">
        An offer. Congratulations!
      </p>
      <div aria-hidden="true" className="confetti">
        {Array.from({ length: 28 }, (_, i) => (
          <span
            key={i}
            className={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
            style={
              {
                "--x": `${(i * 37) % 100}vw`,
                "--delay": `${(i % 7) * 60}ms`,
                "--turn": `${(i % 5) * 80 - 160}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </>
  );
}
