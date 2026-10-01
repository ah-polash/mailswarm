import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/ses";
import { getByPath, resolveMergeTags } from "@/lib/merge";
import { unsubscribeLinks } from "@/lib/unsubscribe";
import { addUtmParams, utmSlug } from "@/lib/utm";
import { emailLinkBaseUrl, localBaseUrlProblem } from "@/lib/public-url";

export { getByPath, resolveMergeTags };

// Constant-time token comparison — avoids leaking the token via response
// timing, and avoids short-circuiting on the first differing byte.
export function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function getBaseUrl(): string {
  return emailLinkBaseUrl();
}

// The public webhook URL for firing one step of a sequence. External systems
// POST the contact payload here to send that step's email.
export function stepWebhookUrl(sequenceId: number, stepNumber: number, token: string): string {
  return `${getBaseUrl()}/send/${sequenceId}/${stepNumber}?token=${token}`;
}

// Resolve the recipient email from a (possibly nested) payload using the
// sequence's configured emailField dot-path, e.g. "objects.user.email".
export function resolveEmail(payload: Record<string, unknown>, emailField: string): string {
  const raw = getByPath(payload, emailField || "email");
  return typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
}

// Returns true if the email must NOT be sent: globally unsubscribed, complained,
// or hard-bounced. Reuses the same CampaignEvent signals the campaign sender uses.
export async function isEmailSuppressed(email: string): Promise<boolean> {
  const events = await prisma.campaignEvent.findMany({
    where: {
      email,
      eventType: { in: ["unsubscribed", "complained", "bounced"] },
    },
    select: { eventType: true, metadata: true },
  });

  for (const ev of events) {
    if (ev.eventType === "complained") return true;
    if (ev.eventType === "unsubscribed") {
      // Global unsubscribe (no specific category) suppresses everything.
      let categoryId: unknown = undefined;
      try {
        categoryId = ev.metadata ? JSON.parse(ev.metadata)?.categoryId : undefined;
      } catch {
        /* treat as global */
      }
      if (!categoryId) return true;
    }
    if (ev.eventType === "bounced") {
      let bounceType: unknown = undefined;
      try {
        bounceType = ev.metadata ? JSON.parse(ev.metadata)?.bounceType : undefined;
      } catch {
        /* ignore */
      }
      if (bounceType === "Permanent" || bounceType === undefined) return true;
    }
  }
  return false;
}

export interface FireStepResult {
  status: "sent" | "suppressed" | "failed";
  messageId?: string;
  error?: string;
}

// Renders step {stepNumber} of {sequenceId} for the given contact payload and
// sends it. Records a SequenceSendLog row. `payload` must contain `email`.
export async function fireSequenceStep(
  sequenceId: number,
  stepNumber: number,
  payload: Record<string, unknown>
): Promise<FireStepResult> {
  const step = await prisma.emailSequenceStep.findUnique({
    where: { sequenceId_stepNumber: { sequenceId, stepNumber } },
    include: { sequence: true },
  });
  if (!step) throw new Error("step_not_found");
  if (step.sequence.status !== "active") throw new Error("sequence_paused");

  const email = resolveEmail(payload, step.sequence.emailField);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("email_not_found");
  }

  async function log(result: FireStepResult) {
    await prisma.sequenceSendLog.create({
      data: {
        sequenceId,
        stepNumber,
        email,
        status: result.status,
        messageId: result.messageId,
        error: result.error,
      },
    });
    return result;
  }

  if (await isEmailSuppressed(email)) {
    return log({ status: "suppressed", error: "recipient suppressed" });
  }

  const baseUrl = getBaseUrl();
  const baseUrlProblem = localBaseUrlProblem(baseUrl);
  if (baseUrlProblem) {
    return log({ status: "failed", error: baseUrlProblem });
  }
  const unsubscribe = unsubscribeLinks(baseUrl, email);

  // Payload values are untrusted (anyone with the webhook token supplies them):
  // escape them inside the HTML body, and strip CR/LF from the header-ish
  // fields (subject, from name) to rule out header injection.
  const stripCrlf = (s: string) => s.replace(/[\r\n]+/g, " ").trim();
  const subject = stripCrlf(resolveMergeTags(step.subject, payload));
  const htmlBody = addUtmParams(
    resolveMergeTags(step.htmlContent, payload, { html: true }),
    { campaign: utmSlug(step.sequence.name), content: `step-${stepNumber}` },
    baseUrl
  );
  const fromName =
    stripCrlf(resolveMergeTags(step.sequence.fromName || "bPlugins", payload)) || "bPlugins";

  const result = await sendEmail({
    to: [email],
    subject,
    htmlBody,
    fromEmail: step.sequence.fromEmail,
    fromName,
    unsubscribeUrl: unsubscribe.pageUrl,
    oneClickUnsubscribeUrl: unsubscribe.oneClickUrl,
  });

  if (result.error) {
    return log({ status: "failed", error: result.error });
  }
  return log({ status: "sent", messageId: result.messageId });
}

export interface DispatchResult {
  event: string;
  matched: number[]; // stepNumbers that matched the event
  results: Array<{ stepNumber: number } & FireStepResult>;
}

// Event-driven fire: read the event name from the payload (sequence.eventField,
// e.g. Freemius "type") and fire every step whose eventType matches. Used by the
// sequence-level webhook so one URL auto-selects the right step(s).
export async function dispatchSequenceEvent(
  sequenceId: number,
  payload: Record<string, unknown>
): Promise<DispatchResult> {
  const sequence = await prisma.emailSequence.findUnique({
    where: { id: sequenceId },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  });
  if (!sequence) throw new Error("sequence_not_found");
  if (sequence.status !== "active") throw new Error("sequence_paused");

  const raw = getByPath(payload, sequence.eventField || "type");
  const event = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
  if (!event) throw new Error("event_not_found");

  const matches = sequence.steps.filter((s) => (s.eventType || "").trim() === event);

  const results: Array<{ stepNumber: number } & FireStepResult> = [];
  for (const step of matches) {
    try {
      const r = await fireSequenceStep(sequenceId, step.stepNumber, payload);
      results.push({ stepNumber: step.stepNumber, ...r });
    } catch (e) {
      results.push({
        stepNumber: step.stepNumber,
        status: "failed",
        error: e instanceof Error ? e.message : "error",
      });
    }
  }

  return { event, matched: matches.map((s) => s.stepNumber), results };
}
