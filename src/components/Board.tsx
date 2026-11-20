"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import Link from "next/link";
import {
  useEffect,
  useId,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { moveApplicationAction } from "@/app/actions";
import { countByStatus, filterCards } from "@/lib/board";
import type { DeadlineInfo } from "@/lib/dates";
import { isStatus, STATUS_LABELS, STATUSES, type Status } from "@/lib/status";

export type BoardCard = {
  id: string;
  company: string;
  role: string;
  location: string | null;
  status: Status;
  deadline: DeadlineInfo | null;
  followUp: string | null;
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

/**
 * Keyboard moves go a whole column at a time: with a card picked up, the
 * left and right arrow keys carry it to the neighbouring stage.
 */
const moveByColumn: KeyboardCoordinateGetter = (
  event,
  { currentCoordinates, context },
) => {
  const step =
    event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0;
  if (step === 0) return undefined;
  event.preventDefault();

  const columns = STATUSES.map((status) => context.droppableRects.get(status));
  const centre = currentCoordinates.x + (context.collisionRect?.width ?? 0) / 2;
  const current = columns.findIndex(
    (rect) => rect && centre >= rect.left && centre < rect.right,
  );
  const target = columns[Math.max(0, current) + step];
  if (!target) return undefined;
  return { x: target.left + 8, y: target.top + 8 };
};

const KEYBOARD_INSTRUCTIONS =
  "To move this application to another stage, press space, use the left and right arrow keys to choose the stage, then press space again. Press escape to cancel.";

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
  // After a keyboard move the card is drawn again in its new column, which
  // would drop keyboard focus. This remembers which card to give it back to.
  const [refocusId, setRefocusId] = useState<string | null>(null);
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
    // Starts only from a card's "Move" button, so Enter on the card's link
    // still opens it.
    useSensor(KeyboardSensor, {
      coordinateGetter: moveByColumn,
      keyboardCodes: {
        start: ["Space", "Enter"],
        cancel: ["Escape"],
        end: ["Space", "Enter"],
      },
    }),
  );

  const companyOf = (id: string | number) =>
    shownCards.find((card) => card.id === String(id))?.company ?? "card";
  const stageOf = (id: string | number | undefined) =>
    isStatus(id) ? STATUS_LABELS[id] : null;

  function handleDragStart(event: DragStartEvent) {
    setDraggedId(String(event.active.id));
    setRefocusId(null);
    setError(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggedId(null);
    const target = event.over?.id;
    const id = String(event.active.id);
    if (event.activatorEvent instanceof KeyboardEvent) setRefocusId(id);
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

  const filtering = query.trim() !== "";
  const visibleCards = filterCards(shownCards, query);
  const counts = countByStatus(visibleCards);

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggedId(null)}
      accessibility={{
        screenReaderInstructions: { draggable: KEYBOARD_INSTRUCTIONS },
        announcements: {
          onDragStart: ({ active }) => `Picked up ${companyOf(active.id)}.`,
          onDragOver: ({ active, over }) =>
            stageOf(over?.id)
              ? `${companyOf(active.id)} is over ${stageOf(over?.id)}.`
              : undefined,
          onDragEnd: ({ active, over }) =>
            stageOf(over?.id)
              ? `${companyOf(active.id)} moved to ${stageOf(over?.id)}.`
              : `${companyOf(active.id)} was put back.`,
          onDragCancel: ({ active }) =>
            `Move cancelled. ${companyOf(active.id)} was put back.`,
        },
      }}
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
          {filtering &&
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
              count={counts[status]}
              filtering={filtering}
              draggedId={draggedId}
              linked={!demo}
              refocusId={refocusId}
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
  count,
  draggedId,
  linked,
  filtering,
  refocusId,
}: {
  count: number;
  refocusId: string | null;
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
        {STATUS_LABELS[status]}{" "}
        <span className="font-sans text-base font-medium text-ink-soft">
          ({count})
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
            takeFocus={card.id === refocusId}
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
  takeFocus,
}: {
  card: BoardCard;
  hidden: boolean;
  linked: boolean;
  takeFocus: boolean;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, attributes } =
    useDraggable({ id: card.id });
  const moveButton = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (takeFocus) moveButton.current?.focus();
  }, [takeFocus]);

  return (
    // Mouse and touch can drag the whole card. Keyboard dragging starts only
    // from the "Move" button below, which the keyboard sensor treats as the
    // card's handle.
    <div
      ref={setNodeRef}
      {...listeners}
      className={`group/card relative cursor-grab touch-manipulation select-none ${
        hidden ? "opacity-30" : ""
      }`}
    >
      <CardBody card={card} asLink={linked} />
      <button
        ref={(node) => {
          moveButton.current = node;
          setActivatorNodeRef(node);
        }}
        type="button"
        {...attributes}
        aria-label={`Move ${card.company}`}
        className="absolute top-1.5 right-1.5 z-10 rounded border border-line bg-surface px-1.5 py-0.5 text-xs font-semibold opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100"
      >
        Move
      </button>
    </div>
  );
}

function CardBody({ card, asLink }: { card: BoardCard; asLink: boolean }) {
  // The deadline is the last day to apply, so it stops mattering once the
  // card has left the wishlist (including right after a drag).
  const deadline = card.status === "wishlist" ? card.deadline : null;
  const followUp = card.status === "applied" ? card.followUp : null;
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
      {(deadline || followUp || card.matchScore !== null) && (
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
          {followUp && (
            <span className="hl hl-yellow font-medium">{followUp}</span>
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
