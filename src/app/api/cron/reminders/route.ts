import {
  areRemindersConfigured,
  isCronAuthorized,
  sendDueReminders,
} from "@/lib/reminders";

// Called once a day by the host's scheduler (see vercel.json), which sends
// the CRON_SECRET. Anyone else gets "401 Unauthorized".
export async function GET(request: Request): Promise<Response> {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (!areRemindersConfigured()) {
    return Response.json(
      { message: "Email reminders are not set up." },
      { status: 503 },
    );
  }
  return Response.json(await sendDueReminders(new Date()));
}
