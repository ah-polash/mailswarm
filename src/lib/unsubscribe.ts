import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { tagContactAllEmailsUnsubscribed } from "@/lib/swipeone";

// Unsubscribe links carry an HMAC signature (`t`) over the email address and
// campaign id, so only the recipient of an email can open its preferences page
// or unsubscribe with it. Without it, anyone could read or change anyone's
// preferences by editing the address in the URL.
//
// The key is derived from AUTH_SECRET: rotating AUTH_SECRET breaks every
// unsubscribe link already sent.

// Links sent before signing was added have no `t`. Until this date they still
// work, but only for "unsubscribe from all" — they can't read or change
// category preferences. After it they are refused.
const LEGACY_LINKS_UNTIL = new Date("2026-12-01T00:00:00Z");

function signingKey(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return `unsubscribe:${secret}`;
}

function sign(email: string, campaignId?: string | null): string {
  return createHmac("sha256", signingKey())
    .update(`${email.trim().toLowerCase()}\n${campaignId || ""}`)
    .digest("base64url");
}

/** Page link (email footer) and one-click link (List-Unsubscribe header). */
export function unsubscribeLinks(baseUrl: string, email: string, campaignId?: string | null) {
  const params = new URLSearchParams({ email });
  if (campaignId) params.set("campaignId", campaignId);
  params.set("t", sign(email, campaignId));
  const query = params.toString();
  return {
    pageUrl: `${baseUrl}/unsubscribe?${query}`,
    oneClickUrl: `${baseUrl}/api/unsubscribe/one-click?${query}`,
  };
}

export type UnsubscribeAccess = "full" | "legacy" | "denied";

/**
 * "full": valid signature. "legacy": an old unsigned link still inside the
 * grace period (global unsubscribe only). "denied": anything else.
 */
export function unsubscribeAccess(
  email: string,
  campaignId: string | null | undefined,
  token: string | null | undefined
): UnsubscribeAccess {
  if (!token) return Date.now() < LEGACY_LINKS_UNTIL.getTime() ? "legacy" : "denied";
  const expected = Buffer.from(sign(email, campaignId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given) ? "full" : "denied";
}

export async function applyGlobalUnsubscribe(args: {
  email: string;
  campaignId?: string;
  audienceSource: string | null;
}) {
  const { email, campaignId, audienceSource } = args;

  // Idempotent campaign-event recording (only if we have a campaign context).
  if (campaignId) {
    const existing = await prisma.campaignEvent.findFirst({
      where: { campaignId, email, eventType: "unsubscribed" },
    });
    if (!existing) {
      await prisma.campaignEvent.create({
        data: {
          campaignId,
          email,
          eventType: "unsubscribed",
          metadata: JSON.stringify({
            scope: "all",
            timestamp: new Date().toISOString(),
          }),
        },
      });
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { totalUnsubscribed: { increment: 1 } },
      });
    } else {
      // Upgrade an existing category-scoped unsub to a global unsub by
      // rewriting its metadata. The event is already counted.
      try {
        const meta = JSON.parse(existing.metadata || "{}");
        if (meta?.scope === "categories") {
          await prisma.campaignEvent.update({
            where: { id: existing.id },
            data: {
              metadata: JSON.stringify({
                scope: "all",
                timestamp: new Date().toISOString(),
              }),
            },
          });
        }
      } catch { /* ignore */ }
    }
  }

  // Best-effort SwipeOne tagging (runs regardless of audience source — every
  // global unsubscribe should tag the SwipeOne contact with `all_emails` and
  // `user.marketing.opted_out`).
  try {
    await tagContactAllEmailsUnsubscribed(email);
  } catch {
    // Best-effort — never block the unsubscribe response on SwipeOne.
  }

  // Local Contact upkeep — flip flags so internal-audience campaigns also
  // honor the opt-out, and store the tags locally for the contacts UI.
  if (audienceSource !== "swipeone") {
    const wantedTags = ["all_emails", "unsubscribed", "user.marketing.opted_out"];
    const contact = await prisma.contact.findUnique({ where: { email } });
    if (contact) {
      let tags: string[] = [];
      try { tags = JSON.parse(contact.tags || "[]"); } catch { /* ignore */ }
      for (const t of wantedTags) if (!tags.includes(t)) tags.push(t);
      await prisma.contact.update({
        where: { email },
        data: {
          isMarketingAllowed: false,
          emailMarketingConsent: false,
          tags: JSON.stringify(tags),
        },
      });
    } else {
      await prisma.contact.create({
        data: {
          email,
          isMarketingAllowed: false,
          emailMarketingConsent: false,
          tags: JSON.stringify(wantedTags),
        },
      });
    }
  }
}
