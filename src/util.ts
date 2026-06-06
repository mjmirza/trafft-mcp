/**
 * Shared helpers for tool handlers.
 *
 * Token efficiency is the core design goal. MCP tool results are injected into
 * the model's context window, so every wasted character is a wasted token (the
 * "MCP token tax"). Three measures keep results lean.
 *   1. Compact JSON. No pretty printing. Roughly halves the size.
 *   2. Empty field stripping. null, undefined, and "" are dropped recursively.
 *   3. A hard character cap. One fat list can never flood the context window.
 * The cap is tunable with TRAFFT_MAX_RESPONSE_CHARS (default 20000).
 */

type TextContent = { content: { type: "text"; text: string }[]; isError?: boolean };

const MAX_CHARS = (() => {
  const n = Number(process.env.TRAFFT_MAX_RESPONSE_CHARS);
  return Number.isFinite(n) && n > 0 ? n : 20_000;
})();

/** Recursively drop null, undefined, "", empty objects, and empty arrays. */
function stripEmpty(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripEmpty);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (raw === null || raw === undefined || raw === "") continue;
      const cleaned = stripEmpty(raw);
      if (Array.isArray(cleaned) && cleaned.length === 0) continue;
      if (
        cleaned &&
        typeof cleaned === "object" &&
        !Array.isArray(cleaned) &&
        Object.keys(cleaned).length === 0
      ) {
        continue;
      }
      out[key] = cleaned;
    }
    return out;
  }
  return value;
}

/** Wrap any value as a token-lean MCP text result. */
export function textResult(data: unknown): TextContent {
  let text = typeof data === "string" ? data : JSON.stringify(stripEmpty(data));
  if (text.length > MAX_CHARS) {
    text =
      text.slice(0, MAX_CHARS) +
      `\n[truncated at ${MAX_CHARS} chars to save tokens. Narrow with a filter, a smaller limit, or a specific id.]`;
  }
  return { content: [{ type: "text", text }] };
}

/** Wrap an error as an MCP error result so the model can read and recover. */
export function errorResult(e: unknown): TextContent {
  const msg = e instanceof Error ? e.message : String(e);
  return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
}

/** Build a query string from defined params only. Skips undefined, null, empty. */
export function buildQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    sp.append(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}
