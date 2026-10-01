import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Continues campaigns that are stuck mid-send, so a large campaign finishes
// without anyone keeping the dashboard tab open.
//
// The VPS calls this every 5 minutes from root's crontab (see the mailswarm-vps
// deploy scripts).
//
// Auth: `Authorization: Bearer $CRON_SECRET`, or ?secret=... for manual calls.
// If CRON_SECRET is unset the endpoint is disabled.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    request.nextUrl.searchParams.get("secret") ||
    "";
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stuck = await prisma.campaign.findMany({
    where: { status: "sending" },
    select: { id: true, name: true, totalRecipients: true, totalSent: true },
    orderBy: { updatedAt: "asc" },
    take: 3,
  });

  if (stuck.length === 0) {
    return NextResponse.json({ ok: true, message: "No campaigns are mid-send", processed: [] });
  }

  const baseUrl = (
    process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");

  const processed: Record<string, unknown>[] = [];
  const deadline = Date.now() + 4 * 60 * 1000; // stay inside maxDuration

  for (const campaign of stuck) {
    let sent = 0;
    let done = false;
    let error: string | undefined;

    // Drive the existing idempotent chunked sender until it reports done or we
    // run out of time; the next cron tick picks up wherever this left off.
    while (Date.now() < deadline) {
      const res = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-cron-secret": secret },
        body: JSON.stringify({ chunkSize: 200 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        error = data.error || `chunk failed (${res.status})`;
        break;
      }
      sent += data.result?.sent || 0;
      if (data.result?.done || data.message || (data.result?.remaining ?? 0) <= 0) {
        done = true;
        break;
      }
    }

    processed.push({ id: campaign.id, name: campaign.name, sentThisRun: sent, done, error });
  }

  return NextResponse.json({ ok: true, processed });
}
