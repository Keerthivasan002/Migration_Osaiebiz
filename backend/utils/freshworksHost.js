/**
 * Builds the same Freshservice/Freshdesk hostname logic as field fetch,
 * so ticket/create URLs never become "subdomain.freshservice.com.freshservice.com".
 */
export function normalizeDomain(input) {
  if (!input) return "";
  let domain = String(input)
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "");

  if (domain.endsWith(".freshservice") || domain.endsWith(".freshdesk")) {
    domain = `${domain}.com`;
  }

  return domain;
}

export function getBaseHost(domainInput, product = "freshservice") {
  const normalized = normalizeDomain(domainInput);
  const selected = product === "freshdesk" ? "freshdesk" : "freshservice";
  if (!normalized) return "";
  if (normalized.includes(".")) {
    return normalized;
  }
  return `${normalized}.${selected}.com`;
}

export function getTicketsApiUrl(domainInput, product = "freshservice") {
  const host = getBaseHost(domainInput, product);
  return host ? `https://${host}/api/v2/tickets` : "";
}
