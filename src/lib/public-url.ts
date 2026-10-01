// Every link in an outgoing email (click tracking, open pixel, unsubscribe)
// is built from the app's base URL. A local copy of the app (`npm run dev`)
// still talks to the production database and SES, but its base URL is
// localhost — mail it sends reaches real people with links that only work on
// the developer's machine (this happened to ~925 recipients on 2026-10-01).

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
      `This copy of the app runs at ${baseUrl}, so every link in the email (buttons, ` +
      `unsubscribe) would point to this computer and be broken for recipients. ` +
      `Send from https://mailswarm.bplugins.com instead.`
    );
  }
  return null;
}
