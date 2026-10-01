import {
  SESv2Client,
  SendEmailCommand,
  GetAccountCommand,
  ListEmailIdentitiesCommand,
  GetEmailIdentityCommand,
} from "@aws-sdk/client-sesv2";
import { prisma } from "./db";

let sesClient: SESv2Client | null = null;

export async function getSesConfig() {
  return prisma.sesConfig.findFirst({ where: { isActive: true } });
}

export async function getSesClient(): Promise<SESv2Client | null> {
  const config = await getSesConfig();
  if (!config) return null;

  if (!sesClient) {
    sesClient = new SESv2Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return sesClient;
}

export function resetSesClient() {
  sesClient = null;
}

export async function verifySesConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await getSesClient();
    if (!client) return { success: false, error: "No SES configuration found" };

    await client.send(new GetAccountCommand({}));
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

async function listIdentitiesWithClient(
  client: SESv2Client
): Promise<{ identity: string; type: string; verified: boolean }[]> {
  const listResult = await client.send(new ListEmailIdentitiesCommand({ PageSize: 100 }));
  const items = listResult.EmailIdentities || [];

  const identities: { identity: string; type: string; verified: boolean }[] = [];

  for (const item of items) {
    if (!item.IdentityName) continue;
    try {
      const detail = await client.send(
        new GetEmailIdentityCommand({ EmailIdentity: item.IdentityName })
      );
      identities.push({
        identity: item.IdentityName,
        type: item.IdentityType || "UNKNOWN",
        verified: detail.VerifiedForSendingStatus ?? false,
      });
    } catch {
      identities.push({
        identity: item.IdentityName,
        type: item.IdentityType || "UNKNOWN",
        verified: false,
      });
    }
  }

  return identities;
}

// List verified email identities from SES (uses the active config).
export async function listVerifiedIdentities(): Promise<{
  identities: { identity: string; type: string; verified: boolean }[];
  error?: string;
}> {
  try {
    const client = await getSesClient();
    if (!client) return { identities: [], error: "No SES configuration found" };

    const identities = await listIdentitiesWithClient(client);
    return { identities };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { identities: [], error: message };
  }
}

// Sender address for system notifications (admin alerts, new-account
// credentials). Prefers the active connection's default From address, but falls
// back to any verified email identity so notifications still go out when that
// setting was never filled in.
export async function resolveNotificationSender(): Promise<{ fromEmail: string; error?: string }> {
  const config = await getSesConfig();
  if (!config) return { fromEmail: "", error: "No active SES configuration" };

  const preferred = config.defaultFromEmail?.trim();
  if (preferred) return { fromEmail: preferred };

  const { identities, error } = await listVerifiedIdentities();
  const verified = identities.find((i) => i.verified && i.type === "EMAIL_ADDRESS");
  if (verified) return { fromEmail: verified.identity };

  return {
    fromEmail: "",
    error:
      error ||
      "No sender available — set a default From email on the active SES connection (Settings → SES) or verify an email identity in AWS SES",
  };
}

// List verified email identities from SES using arbitrary credentials.
// Used by the Settings dialog when configuring a non-active connection.
export async function listVerifiedIdentitiesFor(creds: {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}): Promise<{
  identities: { identity: string; type: string; verified: boolean }[];
  error?: string;
}> {
  try {
    const client = new SESv2Client({
      region: creds.region,
      credentials: {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
      },
    });
    const identities = await listIdentitiesWithClient(client);
    return { identities };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { identities: [], error: message };
  }
}

export interface SendEmailParams {
  to: string[];
  subject: string;
  htmlBody: string;
  fromEmail: string;
  fromName: string;
  campaignId?: string;
  unsubscribeUrl?: string;
  /** Target of the List-Unsubscribe header; see unsubscribeLinks() in src/lib/unsubscribe.ts. */
  oneClickUnsubscribeUrl?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ messageId?: string; error?: string }> {
  try {
    const config = await getSesConfig();
    if (!config) return { error: "No SES configuration found" };

    const client = await getSesClient();
    if (!client) return { error: "Could not create SES client" };

    // Add unsubscribe header and footer per SES best practices
    const unsubscribeLink = params.unsubscribeUrl || "";
    const htmlWithUnsubscribe = params.htmlBody + (unsubscribeLink
      ? `<div style="text-align:center;margin-top:32px;padding:16px;font-size:12px;color:#999;">
          <a href="${unsubscribeLink}" style="color:#999;">Unsubscribe from these emails</a>
        </div>`
      : "");

    // One-click (RFC 8058) only when there is an endpoint that accepts the POST;
    // the footer link is a page, which can't.
    const headers: Record<string, string> = {};
    if (params.oneClickUnsubscribeUrl) {
      headers["List-Unsubscribe"] = `<${params.oneClickUnsubscribeUrl}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    } else if (unsubscribeLink) {
      headers["List-Unsubscribe"] = `<${unsubscribeLink}>`;
    }

    const fromAddress = params.fromName
      ? `${params.fromName} <${params.fromEmail}>`
      : params.fromEmail;

    const baseInput = {
      FromEmailAddress: fromAddress,
      Destination: {
        ToAddresses: params.to,
      },
      Content: {
        Simple: {
          Subject: { Data: params.subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: htmlWithUnsubscribe, Charset: "UTF-8" },
          },
          Headers: Object.entries(headers).map(([Name, Value]) => ({ Name, Value })),
        },
      },
    };

    // Try with configuration set first, fallback without it if it doesn't exist
    if (config.configSetName) {
      try {
        const result = await client.send(
          new SendEmailCommand({ ...baseInput, ConfigurationSetName: config.configSetName })
        );
        return { messageId: result.MessageId };
      } catch (sendError: unknown) {
        const errMsg = sendError instanceof Error ? sendError.message : "";
        if (errMsg.includes("Configuration set")) {
          // Config set doesn't exist in SES — retry without it
          const result = await client.send(new SendEmailCommand(baseInput));
          return { messageId: result.MessageId };
        }
        throw sendError;
      }
    }

    const result = await client.send(new SendEmailCommand(baseInput));
    return { messageId: result.MessageId };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { error: message };
  }
}

// Send emails in batches with rate limiting (SES best practice)
export async function sendBulkEmails(
  emails: { to: string; subject: string; htmlBody: string; fromEmail: string; fromName: string; unsubscribeUrl: string; oneClickUnsubscribeUrl: string }[],
  campaignId: string,
  ratePerSecond: number = 10
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Send with a small worker pool. Sequentially this managed ~1.2 emails/sec —
  // every iteration waits on SES *and* a round trip to a remote database — so a
  // 13k campaign took hours. Concurrency stays far below the SES send rate, and
  // each worker records its own event immediately after its own send (events are
  // never batched), so a crash can lose at most the few in flight.
  const CONCURRENCY = Math.max(1, Math.min(10, Math.floor(ratePerSecond)));
  let cursor = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = cursor++;
      if (i >= emails.length) return;
      const email = emails[i];
    const result = await sendEmail({
      to: [email.to],
      subject: email.subject,
      htmlBody: email.htmlBody,
      fromEmail: email.fromEmail,
      fromName: email.fromName,
      campaignId,
      unsubscribeUrl: email.unsubscribeUrl,
      oneClickUnsubscribeUrl: email.oneClickUnsubscribeUrl,
    });

    if (result.messageId) {
      sent++;
      // Record sent event. We deliberately do NOT write a "delivered" event
      // here — SES accepting the SendEmailCommand only means it was queued for
      // sending; the email can still bounce. The SNS Delivery notification is
      // the single source of truth for "delivered".
      await prisma.campaignEvent.create({
        data: {
          campaignId,
          email: email.to,
          eventType: "sent",
          metadata: JSON.stringify({ messageId: result.messageId }),
        },
      });
    } else {
      failed++;
      errors.push(`${email.to}: ${result.error}`);
      await prisma.campaignEvent.create({
        data: {
          campaignId,
          email: email.to,
          eventType: "failed",
          metadata: JSON.stringify({ error: result.error }),
        },
      });
    }

    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  return { sent, failed, errors };
}
