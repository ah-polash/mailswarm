// Adds Google Analytics UTM parameters to the links in an outgoing email, so
// visits from it show up in GA as source/medium "mailswarm / email" with the
// campaign (or sequence) name as utm_campaign.
//
// Only http(s) links are tagged. Links that already carry any utm_* parameter
// are left untouched, so a template can set its own tags by hand. Links back to
// this app (unsubscribe, tracking) are skipped.

export const UTM_SOURCE = "mailswarm";
export const UTM_MEDIUM = "email";

/** "bPlugins Birthday Sale — BIRTHDAY2026" → "bplugins-birthday-sale-birthday2026" */
export function utmSlug(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "email"
  );
}

export function addUtmParams(
  html: string,
  utm: { campaign: string; content?: string },
  appBaseUrl?: string
): string {
  let appHost = "";
  try {
    if (appBaseUrl) appHost = new URL(appBaseUrl).host;
  } catch {
    // ignore
  }

  return html.replace(
    // <a> links, plus Outlook's VML buttons (<v:roundrect href=...>).
    /(<(?:a|v:roundrect|v:rect)\s[^>]*?href=)(["'])([^"']+)\2/gi,
    (match, prefix: string, quote: string, rawHref: string) => {
      // Attribute values may encode & as &amp; — decode before parsing. The
      // rewritten href uses a plain &, which the click tracker needs anyway.
      const href = rawHref.trim().replace(/&amp;/g, "&");
      let url: URL;
      try {
        url = new URL(href);
      } catch {
        return match; // relative links, merge tags like {{url}}, etc.
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") return match;
      if (appHost && url.host === appHost) return match;
      for (const key of url.searchParams.keys()) {
        if (key.toLowerCase().startsWith("utm_")) return match;
      }

      url.searchParams.set("utm_source", UTM_SOURCE);
      url.searchParams.set("utm_medium", UTM_MEDIUM);
      url.searchParams.set("utm_campaign", utm.campaign);
      if (utm.content) url.searchParams.set("utm_content", utm.content);
      return `${prefix}${quote}${url.toString()}${quote}`;
    }
  );
}
