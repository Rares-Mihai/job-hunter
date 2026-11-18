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

export function Board({ cards }: { cards: BoardCard[] }) {
  // Show the card in its new column immediately, before the server confirms.
  const [shownCards, moveOptimistically] = useOptimistic(
    cards,
    (current, move: { id: string; status: Status }) =>
      current.map((card) =>
        card.id === move.id ? { ...card, status: move.status } : card,
      ),
  );
  const [, startTransition] = useTransition();
  const [draggedId, setDraggedId] = useState<string | null>(null);
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

    startTransition(async () => {
      moveOptimistically({ id, status: target });
      const result = await moveApplicationAction(id, target);
      if (!result.ok) setError(result.message);
    });
  }

  const draggedCard = shownCards.find((card) => card.id === draggedId) ?? null;

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
      <div className="-mx-5 overflow-x-auto px-5 pb-4">
        <div className="grid min-w-[1100px] grid-cols-5 gap-5">
          {STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              cards={shownCards.filter((card) => card.status === status)}
              draggedId={draggedId}
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
}: {
  status: Status;
  cards: BoardCard[];
  draggedId: string | null;
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
            {EMPTY_HINT[status]}
          </p>
        )}
        {cards.map((card) => (
          <DraggableCard
            key={card.id}
            card={card}
            hidden={card.id === draggedId}
          />
        ))}
      </div>
    </section>
  );
}

function DraggableCard({ card, hidden }: { card: BoardCard; hidden: boolean }) {
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
      <CardBody card={card} asLink />
    </div>
  );
}

function CardBody({ card, asLink }: { card: BoardCard; asLink: boolean }) {
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
      {(card.deadline || card.matchScore !== null) && (
        <p className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
          {card.deadline && (
            <span
              className={
                card.deadline.tone === "later"
                  ? "text-ink-soft"
                  : "hl hl-pink font-medium"
              }
            >
              {card.deadline.label}
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
