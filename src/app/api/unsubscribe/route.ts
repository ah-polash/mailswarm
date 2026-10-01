import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tagContactWithCategorySlugs } from "@/lib/swipeone";
import { applyGlobalUnsubscribe, unsubscribeAccess } from "@/lib/unsubscribe";

const DENIED = {
  error: "This unsubscribe link is invalid or has expired. Please use the link in a recent email.",
};

// GET: Return info needed to render the unsubscribe page.
// Backwards-compat: if `apply=1` is passed, perform a global unsubscribe
// immediately and return the legacy success payload. Otherwise just return info.
// Every request needs the link's signature (`t`); see src/lib/unsubscribe.ts.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const campaignId = searchParams.get("campaignId");
    const apply = searchParams.get("apply");

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const access = unsubscribeAccess(email, campaignId, searchParams.get("t"));
    if (access === "denied") {
      return NextResponse.json(DENIED, { status: 403 });
    }

    // Resolve campaign + its category (if tagged) so the UI can pre-check it.
    let campaign: Awaited<ReturnType<typeof prisma.campaign.findUnique>> = null;
    if (campaignId) {
      campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    }

    // Legacy / one-click compatibility: when ?apply=1 we perform the original
    // global-unsubscribe behavior so existing links keep working.
    if (apply === "1") {
      if (!campaignId || !campaign) {
        return NextResponse.json(
          { error: "Email and campaignId are required" },
          { status: 400 }
        );
      }
      await applyGlobalUnsubscribe({ email, campaignId, audienceSource: campaign.audienceSource });
      return NextResponse.json({
        success: true,
        message: "You have been successfully unsubscribed.",
      });
    }

    // Unsigned legacy links may only unsubscribe from everything, so don't
    // reveal this address's preferences or campaign to whoever holds one.
    if (access === "legacy") {
      return NextResponse.json({
        email,
        campaign: null,
        categories: [],
        optedOutCategoryIds: [],
        isGloballyUnsubscribed: false,
        legacy: true,
      });
    }

    const categories = await prisma.campaignCategory.findMany({
      orderBy: { createdAt: "asc" },
    });

    const optedOutRows = await prisma.categoryUnsubscribe.findMany({
      where: { email },
      select: { categoryId: true },
    });
    const optedOutCategoryIds = optedOutRows.map((r) => r.categoryId);

    // Only an explicit `scope: "all"` event counts as a global unsubscribe.
    // Older / legacy events without scope metadata are treated as
    // category-scoped (i.e. not global) so the new per-category UI starts
    // clean for those users.
    const recentUnsub = await prisma.campaignEvent.findFirst({
      where: { email, eventType: "unsubscribed" },
      orderBy: { createdAt: "desc" },
      select: { metadata: true },
    });
    let isGloballyUnsubscribed = false;
    if (recentUnsub) {
      try {
        const meta = JSON.parse(recentUnsub.metadata || "{}");
        isGloballyUnsubscribed = meta?.scope === "all";
      } catch { /* ignore */ }
    }

    return NextResponse.json({
      email,
      campaign: campaign
        ? {
            id: campaign.id,
            name: campaign.name,
            categoryId: campaign.categoryId,
          }
        : null,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        autoCheckOnUnsubscribe: c.autoCheckOnUnsubscribe,
      })),
      optedOutCategoryIds,
      isGloballyUnsubscribed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Apply the user's unsubscribe choice.
// Body: { email, campaignId?, t, scope: "all" | "categories", categoryIds?: string[] }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const campaignId = typeof body?.campaignId === "string" ? body.campaignId : undefined;
    const scope = body?.scope === "all" ? "all" : "categories";
    const categoryIds: string[] = Array.isArray(body?.categoryIds)
      ? body.categoryIds.filter((id: unknown): id is string => typeof id === "string")
      : [];

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const access = unsubscribeAccess(email, campaignId, typeof body?.t === "string" ? body.t : null);
    if (access === "denied" || (access === "legacy" && scope !== "all")) {
      return NextResponse.json(DENIED, { status: 403 });
    }

    let campaign: Awaited<ReturnType<typeof prisma.campaign.findUnique>> = null;
    if (campaignId) {
      campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
      if (!campaign) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }
    }

    if (scope === "all") {
      await applyGlobalUnsubscribe({
        email,
        campaignId,
        audienceSource: campaign?.audienceSource ?? null,
      });
      return NextResponse.json({
        success: true,
        scope: "all",
        message: "You have been unsubscribed from all emails.",
      });
    }

    // scope === "categories": replace the user's category opt-outs with
    // exactly the provided list (idempotent).
    if (categoryIds.length === 0) {
      // No categories selected and not "unsubscribe all" — nothing to do, but
      // still treat as a successful preference update so the UI can confirm.
      await prisma.categoryUnsubscribe.deleteMany({ where: { email } });
      return NextResponse.json({
        success: true,
        scope: "categories",
        categoryIds: [],
        message: "Your preferences have been updated.",
      });
    }

    const validCategories = await prisma.campaignCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, slug: true, swipeOneTagOverride: true },
    });
    const validIds = new Set(validCategories.map((c) => c.id));
    if (validIds.size === 0) {
      return NextResponse.json({ error: "No valid categories selected" }, { status: 400 });
    }

    // Reset to the requested set: remove rows not in validIds, upsert the rest.
    await prisma.categoryUnsubscribe.deleteMany({
      where: {
        email,
        categoryId: { notIn: Array.from(validIds) },
      },
    });

    for (const cid of validIds) {
      await prisma.categoryUnsubscribe.upsert({
        where: { email_categoryId: { email, categoryId: cid } },
        create: { email, categoryId: cid, campaignId: campaignId || null },
        update: {},
      });
    }

    if (campaignId) {
      // Record a category-scoped unsubscribe event (idempotent per campaign).
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
              scope: "categories",
              categoryIds: Array.from(validIds),
              timestamp: new Date().toISOString(),
            }),
          },
        });
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { totalUnsubscribed: { increment: 1 } },
        });
      }
    }

    // Best-effort: tag the contact in SwipeOne with the chosen category tags
    // (override → falls back to slug) so downstream automations can exclude
    // them from those categories.
    try {
      await tagContactWithCategorySlugs(
        email,
        validCategories.map((c) => c.swipeOneTagOverride?.trim() || c.slug)
      );
    } catch {
      // Best-effort — never block the unsubscribe response on SwipeOne.
    }

    return NextResponse.json({
      success: true,
      scope: "categories",
      categoryIds: Array.from(validIds),
      message: "Your category preferences have been updated.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
