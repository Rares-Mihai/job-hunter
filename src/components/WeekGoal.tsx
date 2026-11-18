/** This week's progress towards the weekly goal, and the current streak. */
export function WeekGoal({
  sent,
  target,
  streakWeeks,
}: {
  sent: number;
  target: number;
  streakWeeks: number;
}) {
  const reached = sent >= target;
  const share = Math.min(100, Math.round((sent / target) * 100));

  return (
    <section
      aria-label="This week's goal"
      className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2"
    >
      <p className="font-semibold">
        This week: {sent} of {target} sent
      </p>
      {/* The track is a faint step of the same blue, so the bar reads as one measure. */}
      <div
        aria-hidden="true"
        className="h-2 w-48 max-w-full overflow-hidden rounded-full bg-pen/15"
      >
        <div
          className="h-full rounded-full bg-pen"
          style={{ width: `${share}%` }}
        />
      </div>
      {reached && <p className="hl hl-green font-medium">Goal reached</p>}
      {streakWeeks >= 2 && (
        <p className="text-ink-soft">{streakWeeks} weeks in a row</p>
      )}
    </section>
  );
}
