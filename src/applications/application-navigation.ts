export function applicationListPath(query: string, filter: string) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (filter !== "all") params.set("status", filter);
  return params.size
    ? `/applications?${params.toString()}`
    : "/applications";
}

export function applicationDetailPath(id: string, listPath: string) {
  return `/applications/${encodeURIComponent(id)}?from=${encodeURIComponent(listPath)}`;
}

export function safeApplicationListPath(candidate: string | null) {
  return candidate && /^\/applications(?:\?|$)/.test(candidate)
    ? candidate
    : "/applications";
}
