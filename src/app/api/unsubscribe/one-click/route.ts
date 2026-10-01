import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { applyGlobalUnsubscribe, unsubscribeAccess } from "@/lib/unsubscribe";

// RFC 8058 one-click unsubscribe: the target of the List-Unsubscribe header.
// Gmail/Yahoo POST `List-Unsubscribe=One-Click` here when the recipient clicks
// their built-in "Unsubscribe" button. Only signed links are accepted — mail
// clients never show the preferences page, so there is no legacy fallback.
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.trim() || "";
    const campaignId = searchParams.get("campaignId") || undefined;

    if (!email || unsubscribeAccess(email, campaignId, searchParams.get("t")) !== "full") {
      return NextResponse.json({ error: "Invalid unsubscribe link" }, { status: 403 });
    }

    const campaign = campaignId
      ? await prisma.campaign.findUnique({ where: { id: campaignId }, select: { audienceSource: true } })
      : null;

    await applyGlobalUnsubscribe({
      email,
      campaignId: campaign ? campaignId : undefined,
      audienceSource: campaign?.audienceSource ?? null,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
