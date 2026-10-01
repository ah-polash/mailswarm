import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendBulkEmails } from "@/lib/ses";
import { getSegmentContacts } from "@/lib/swipeone";
import { unsubscribeLinks } from "@/lib/unsubscribe";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Normally super-admin only. The scheduled resume job has no session, so it
    // authenticates with CRON_SECRET instead (shared secret, never public).
    const cronSecret = process.env.CRON_SECRET;
    const providedCronSecret = request.headers.get("x-cron-secret") || "";
    const isCron = !!cronSecret && providedCronSecret === cronSecret;
    if (!isCron) {
      await requireSuperAdmin();
    }

    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Allow re-running on draft/scheduled (initial send) AND on
    // sending/sent/failed (idempotent resume — only emails without a successful
    // "sent" event are re-attempted). This is what powers "Send to Failed
    // Contacts" and recovery from serverless timeouts mid-bulk-send.
    const RESUMABLE_STATUSES = new Set([
      "draft",
      "pending_review", // submitted by a general user, admin completes + sends
      "scheduled",
      "sending",
      "sent",
      "failed",
    ]);
    if (!RESUMABLE_STATUSES.has(campaign.status)) {
      return NextResponse.json(
        { error: `Campaign cannot be sent from status "${campaign.status}"` },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { scheduledAt } = body;

    // Chunk size: emails to process per request. Keeping each request well
    // under the serverless timeout means the frontend (or "Send to
    // Failed/Pending") can drive a large list to completion via repeated
    // chunked calls. The route is idempotent — already-sent recipients are
    // skipped automatically — so chunking is just rate-limiting the loop.
    const requestedChunk = Number(body?.chunkSize);
    const DEFAULT_CHUNK = 50;
    const MAX_CHUNK = 2000;
    const chunkSize = Number.isFinite(requestedChunk) && requestedChunk > 0
      ? Math.min(Math.floor(requestedChunk), MAX_CHUNK)
      : DEFAULT_CHUNK;

    // Schedule for later
    if (scheduledAt) {
      const updated = await prisma.campaign.update({
        where: { id },
        data: {
          status: "scheduled",
          scheduledAt: new Date(scheduledAt),
        },
      });
      return NextResponse.json({ campaign: updated });
    }

    if (!campaign.fromEmail) {
      return NextResponse.json(
        { error: "No sender email set for this campaign" },
        { status: 400 }
      );
    }

    const contactByEmail = new Map<string, Record<string, unknown>>();
    const suppressedEmails = new Set<string>();
    let recipientEmails: string[] = [];

    if (campaign.audienceSource === "swipeone") {
      // Resolve recipients from SwipeOne segments at send time.
      const segmentIds: string[] = campaign.segmentIds ? JSON.parse(campaign.segmentIds) : [];
      if (segmentIds.length === 0) {
        return NextResponse.json(
          { error: "No SwipeOne segments configured for this campaign" },
          { status: 400 }
        );
      }

      // Resolving a segment means paginating every contact out of SwipeOne
      // (100 per request). For a 13k-contact segment that is ~140 API calls —
      // far too slow to repeat for every 50-email chunk, and a reliable way to
      // hit the rate limit. So resolve once, cache the audience on the campaign,
      // and reuse it for the remaining chunks of this send.
      const cached: { email: string; contact: Record<string, unknown> }[] =
        campaign.recipientEmails ? JSON.parse(campaign.recipientEmails) : [];

      if (Array.isArray(cached) && cached.length > 0 && typeof cached[0] === "object") {
        for (const row of cached) {
          if (!row?.email) continue;
          contactByEmail.set(row.email, row.contact || { email: row.email });
        }
        recipientEmails = cached.map((r) => r.email).filter(Boolean);
      } else {
        const seenEmails = new Set<string>();
        for (const segmentId of segmentIds) {
          const contacts = await getSegmentContacts(segmentId);
          for (const c of contacts as unknown as Record<string, unknown>[]) {
            const email = typeof c.email === "string" ? c.email : "";
            if (!email || seenEmails.has(email)) continue;
            seenEmails.add(email);
            contactByEmail.set(email, c);
          }
        }
        recipientEmails = Array.from(seenEmails);

        // Persist the resolved audience so later chunks skip the SwipeOne pull.
        // Keep ONLY the fields this email actually interpolates: a full SwipeOne
        // contact is ~1.3KB, so caching whole objects for a 13k segment produced
        // an ~18MB row that every chunk re-read — which is how we exhausted the
        // database's data-transfer quota. Storing just the used merge fields
        // takes that to well under 1MB.
        if (recipientEmails.length > 0) {
          const usedFields = new Set<string>();
          for (const m of `${campaign.htmlContent} ${campaign.subject}`.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) {
            usedFields.add(m[1]);
          }

          const slim = recipientEmails.map((email) => {
            const full = contactByEmail.get(email) || {};
            const contact: Record<string, unknown> = { email };
            for (const f of usedFields) {
              if (f !== "email" && full[f] !== undefined) contact[f] = full[f];
            }
            return { email, contact };
          });

          await prisma.campaign.update({
            where: { id },
            data: { recipientEmails: JSON.stringify(slim) },
          });
        }
      }

      if (recipientEmails.length === 0) {
        return NextResponse.json(
          { error: "SwipeOne segments returned no contacts" },
          { status: 400 }
        );
      }
    } else {
      // Stored recipient emails from internal/manual sources
      recipientEmails = campaign.recipientEmails ? JSON.parse(campaign.recipientEmails) : [];

      if (recipientEmails.length === 0) {
        return NextResponse.json(
          { error: "No recipients found for this campaign" },
          { status: 400 }
        );
      }

      // Look up contact data from local DB for merge tags + suppression
      const contacts = await prisma.contact.findMany({
        where: { email: { in: recipientEmails } },
      });

      for (const contact of contacts) {
        const { properties, ...rest } = contact as unknown as Record<string, unknown>;
        let parsed: Record<string, unknown> = {};
        if (typeof properties === "string" && properties) {
          try { parsed = JSON.parse(properties); } catch { /* ignore */ }
        }
        contactByEmail.set(contact.email, { ...rest, ...parsed });

        if (!contact.isMarketingAllowed) {
          suppressedEmails.add(contact.email);
        }
      }
    }

    // Only one batch may run per campaign at a time. Without this, two senders
    // (a browser tab, the cron job, a retried request whose client timed out)
    // each snapshot "already sent" at start and re-send the overlap — which is
    // exactly how duplicate emails happen. Claim the lock atomically: the
    // updateMany only matches when the lock is free or stale.
    const LOCK_STALE_MS = 15 * 60 * 1000;
    const staleBefore = new Date(Date.now() - LOCK_STALE_MS);
    const claimed = await prisma.campaign.updateMany({
      where: {
        id,
        OR: [{ sendLockedAt: null }, { sendLockedAt: { lt: staleBefore } }],
      },
      data: { sendLockedAt: new Date(), status: "sending" },
    });
    if (claimed.count === 0) {
      return NextResponse.json(
        { error: "A send is already in progress for this campaign. Try again shortly." },
        { status: 409 }
      );
    }

    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Also check for any previously bounced (hard) or complained emails across all campaigns
    const suppressedEvents = await prisma.campaignEvent.findMany({
      where: { eventType: { in: ["bounced", "complained", "unsubscribed"] } },
      select: { email: true, eventType: true, metadata: true },
    });

    for (const event of suppressedEvents) {
      if (event.eventType === "complained") {
        suppressedEmails.add(event.email);
      }
      if (event.eventType === "unsubscribed") {
        // Global unsubscribe (no specific category) → always suppress.
        // Category-scoped unsubscribes are tracked in CategoryUnsubscribe and
        // handled below; we don't suppress on those here.
        let scope: string | undefined;
        try {
          const meta = JSON.parse(event.metadata || "{}");
          scope = typeof meta?.scope === "string" ? meta.scope : undefined;
        } catch { /* ignore */ }
        if (scope !== "categories") {
          suppressedEmails.add(event.email);
        }
      }
      // Only suppress permanent/hard bounces, not transient send failures
      if (event.eventType === "bounced") {
        try {
          const meta = JSON.parse(event.metadata || "{}");
          if (meta.bounceType === "Permanent" || meta.bounceSubType) {
            suppressedEmails.add(event.email);
          }
        } catch { /* ignore */ }
      }
    }

    // Per-category unsubscribes: if this campaign is tagged with a category,
    // suppress recipients who unsubscribed from that specific category.
    if (campaign.categoryId) {
      const categoryOptOuts = await prisma.categoryUnsubscribe.findMany({
        where: { categoryId: campaign.categoryId },
        select: { email: true },
      });
      for (const row of categoryOptOuts) suppressedEmails.add(row.email);
    }

    // Find recipients who already received this campaign successfully so a
    // resumed send (after a timeout / partial failure) doesn't double-deliver.
    const alreadySentEvents = await prisma.campaignEvent.findMany({
      where: { campaignId: id, eventType: "sent" },
      select: { email: true },
    });
    const alreadySentEmails = new Set(alreadySentEvents.map((e) => e.email));

    // Filter out suppressed recipients AND ones we've already successfully sent to
    const eligibleEmails = recipientEmails.filter(
      (e) => !suppressedEmails.has(e) && !alreadySentEmails.has(e)
    );
    const skippedCount = recipientEmails.length - eligibleEmails.length;

    // Set totalRecipients now so the /progress endpoint can compute the denominator
    // while the bulk send is still in flight.
    await prisma.campaign.update({
      where: { id },
      data: { totalRecipients: recipientEmails.length },
    });

    if (eligibleEmails.length === 0) {
      // If everyone has already been sent, mark complete and report success.
      if (alreadySentEmails.size > 0 && alreadySentEmails.size >= recipientEmails.length - suppressedEmails.size) {
        const updated = await prisma.campaign.update({
          where: { id },
          data: {
            status: "sent",
            sentAt: campaign.sentAt ?? new Date(),
            totalSent: alreadySentEmails.size,
            totalRecipients: recipientEmails.length,
          },
        });
        await prisma.campaign.updateMany({ where: { id }, data: { sendLockedAt: null } });
        return NextResponse.json({
          campaign: updated,
          result: {
            sent: 0,
            failed: 0,
            skipped: skippedCount,
            alreadySent: alreadySentEmails.size,
            errors: [] as string[],
          },
          message: "All eligible recipients already received this campaign.",
        });
      }
      await prisma.campaign.update({
        where: { id },
        data: { status: "sent", sentAt: new Date(), totalSent: 0, totalRecipients: recipientEmails.length },
      });
      await prisma.campaign.updateMany({ where: { id }, data: { sendLockedAt: null } });
      return NextResponse.json({
        error: `All ${recipientEmails.length} recipient(s) are suppressed (unsubscribed, bounced, or complained). No emails sent.`,
        skipped: skippedCount,
      }, { status: 422 });
    }

    // Replace {{propertyName}} merge tags with actual contact values
    function resolveMergeTags(template: string, contactData: Record<string, unknown>): string {
      return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
        const value = contactData[key];
        if (value === null || value === undefined || value === "") return "";
        if (typeof value === "object") {
          try { return JSON.stringify(value); } catch { return ""; }
        }
        return String(value);
      });
    }

    // Wrap all <a href="..."> links with click tracking redirect
    function wrapLinksForTracking(html: string, campaignId: string, recipientEmail: string): string {
      return html.replace(
        /<a\s([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi,
        (_match, before, href: string, after) => {
          // Don't wrap unsubscribe links, mailto:, tel:, or anchor links
          if (href.includes("/unsubscribe") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) {
            return _match;
          }
          const trackUrl = `${baseUrl}/api/track/click?c=${campaignId}&e=${encodeURIComponent(recipientEmail)}&url=${encodeURIComponent(href)}`;
          return `<a ${before}href="${trackUrl}"${after}>`;
        }
      );
    }

    // Append open tracking pixel before </body> or at end
    function injectOpenPixel(html: string, campaignId: string, recipientEmail: string): string {
      const pixel = `<img src="${baseUrl}/api/track/open?c=${campaignId}&e=${encodeURIComponent(recipientEmail)}" width="1" height="1" style="display:none" alt="" />`;
      if (html.includes("</body>")) {
        return html.replace("</body>", `${pixel}</body>`);
      }
      return html + pixel;
    }

    // Process at most `chunkSize` emails per request so we stay safely under
    // the serverless function timeout. Anyone past the chunk is left for the
    // next call — the alreadySentEmails set picks them up correctly because
    // the route is idempotent.
    const chunkEmails = eligibleEmails.slice(0, chunkSize);
    const remainingAfterChunk = eligibleEmails.length - chunkEmails.length;

    // Mark status="sending" while we still have more to process so the list
    // page shows the right state and the resume button stays available.
    if (remainingAfterChunk > 0 && campaign.status !== "sending") {
      await prisma.campaign.update({
        where: { id },
        data: { status: "sending" },
      });
    }

    const emails = chunkEmails.map((email) => {
      const contactData = contactByEmail.get(email) || { email };
      let htmlBody = resolveMergeTags(campaign.htmlContent, contactData);
      htmlBody = wrapLinksForTracking(htmlBody, id, email);
      htmlBody = injectOpenPixel(htmlBody, id, email);
      const unsubscribe = unsubscribeLinks(baseUrl, email, id);
      return {
        to: email,
        subject: resolveMergeTags(campaign.subject, contactData),
        htmlBody,
        fromEmail: campaign.fromEmail,
        fromName: campaign.fromName,
        unsubscribeUrl: unsubscribe.pageUrl,
        oneClickUnsubscribeUrl: unsubscribe.oneClickUrl,
      };
    });

    const result = await sendBulkEmails(emails, id);

    // If everyone we tried this round failed AND we've never successfully
    // sent any in prior rounds, the whole campaign is failed.
    if (result.sent === 0 && result.failed > 0 && alreadySentEmails.size === 0) {
      const updated = await prisma.campaign.update({
        where: { id },
        data: {
          totalSent: 0,
          status: "failed",
        },
      });
      await prisma.campaign.updateMany({ where: { id }, data: { sendLockedAt: null } });
      return NextResponse.json({
        campaign: updated,
        result: {
          sent: result.sent,
          failed: result.failed,
          errors: result.errors,
          remaining: remainingAfterChunk,
          done: false,
        },
        error: `All emails failed to send. ${result.errors[0] || ""}`,
      }, { status: 422 });
    }

    // Update cumulative totals. Only flip status to "sent" when there is
    // nothing remaining for this campaign. Otherwise keep "sending" so the
    // caller / list page knows to keep going.
    const totalSentCumulative = alreadySentEmails.size + result.sent;
    const done = remainingAfterChunk === 0;
    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        totalRecipients: recipientEmails.length,
        totalSent: totalSentCumulative,
        status: done ? "sent" : "sending",
        sentAt: done ? (campaign.sentAt ?? new Date()) : campaign.sentAt,
        sendLockedAt: null, // batch finished — let the next one start
      },
    });

    return NextResponse.json({
      campaign: updated,
      result: {
        sent: result.sent,
        failed: result.failed,
        skipped: skippedCount,
        errors: result.errors,
        remaining: remainingAfterChunk,
        done,
        chunkSize,
      },
    });
  } catch (error) {
    // Never leave the lock held on a failure.
    await prisma.campaign.updateMany({ where: { id }, data: { sendLockedAt: null } }).catch(() => {});
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    // Mark campaign as failed on error
    try {
      await prisma.campaign.update({
        where: { id },
        data: { status: "failed" },
      });
    } catch {
      // Ignore update error
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
