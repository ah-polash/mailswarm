// Every link in an outgoing email (click tracking, open pixel, unsubscribe)
// is built from the app's base URL. A local copy of the app (`npm run dev`)
// still talks to the production database and SES, but its base URL is
// localhost — mail it sends reaches real people with links that only work on
// the developer's machine (this happened to ~925 recipients on 2026-10-01).
//
// EMAIL_LINK_BASE_URL decouples the two: a local copy with
// EMAIL_LINK_BASE_URL=https://mailswarm.bplugins.com can send, and every link
// it puts in an email points at the live server (same database, same
// AUTH_SECRET, so tracking and signed unsubscribe links work there).

/** Base URL for links inside outgoing emails. */
export function emailLinkBaseUrl(): string {
  return (
    process.env.EMAIL_LINK_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "::1"]);

/** Why emails can't be sent with this base URL, or null if it's public. */
export function localBaseUrlProblem(baseUrl: string): string | null {
  let host: string;
  try {
    host = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return `The app URL "${baseUrl}" is not a valid URL, so links in the email would be broken.`;
  }
  if (LOCAL_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local")) {
    return (
      `Email links would point to ${baseUrl}, which only works on this computer, so ` +
      `buttons and unsubscribe links would be broken for recipients. Send from ` +
      `https://mailswarm.bplugins.com, or set EMAIL_LINK_BASE_URL=https://mailswarm.bplugins.com ` +
      `in this copy's .env and restart it.`
    );
  }
  return null;
}
