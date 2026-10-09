#!/usr/bin/env node
/**
 * trafft-mcp doctor.
 *
 * A guided preflight. Checks that the three settings are present, that the URL
 * is https, that authentication works live, and that a couple of read
 * endpoints respond. Prints a clear pass or fail line per check and, when
 * something is wrong, the exact thing to fix. Run it before wiring the server
 * into a client so a bad credential is caught in seconds, not mid-session.
 */
import "dotenv/config";
import { TrafftClient } from "./client.js";

type Line = { ok: boolean; label: string; detail: string };
const lines: Line[] = [];
const ok = (label: string, detail = "") => lines.push({ ok: true, label, detail });
const bad = (label: string, detail: string) => lines.push({ ok: false, label, detail });

async function main(): Promise<void> {
  const apiUrl = process.env.TRAFFT_API_URL;
  const clientId = process.env.TRAFFT_CLIENT_ID;
  const clientSecret = process.env.TRAFFT_CLIENT_SECRET;
  const apiPath = process.env.TRAFFT_API_PATH;

  // 1. Settings present.
  if (!apiUrl) bad("TRAFFT_API_URL", "missing. set it to your Trafft API URL. see .env.example");
  else ok("TRAFFT_API_URL", apiUrl);
  if (!clientId) bad("TRAFFT_CLIENT_ID", "missing. copy it from Trafft settings, API.");
  else ok("TRAFFT_CLIENT_ID", "set");
  if (!clientSecret) bad("TRAFFT_CLIENT_SECRET", "missing. copy it from Trafft settings, API.");
  else ok("TRAFFT_CLIENT_SECRET", "set");

  if (apiUrl && clientId && clientSecret) {
    let client: TrafftClient | undefined;
    // 2. URL valid and https.
    try {
      client = new TrafftClient({ apiUrl, clientId, clientSecret, apiPath });
      ok("API URL valid", "https accepted");
    } catch (e) {
      bad("API URL valid", e instanceof Error ? e.message : String(e));
    }

    if (client) {
      // 3. Live authentication.
      try {
        await client.authenticate();
        ok("Authentication", "token received");
      } catch (e) {
        bad("Authentication", e instanceof Error ? e.message : String(e));
      }

      // 4. A read endpoint responds.
      try {
        await client.get("/services");
        ok("Read endpoints", "/services responded");
      } catch (e) {
        bad("Read endpoints", e instanceof Error ? e.message : String(e));
      }
    }
  } else {
    bad("Live checks", "skipped until all three settings are present");
  }

  const mark = (l: Line) => (l.ok ? "PASS" : "FAIL");
  console.error("trafft-mcp doctor");
  console.error("");
  for (const l of lines) console.error(`  ${mark(l)}  ${l.label}${l.detail ? `. ${l.detail}` : ""}`);
  console.error("");
  const failed = lines.filter((l) => !l.ok);
  if (failed.length === 0) {
    console.error("All checks passed. The server is ready to wire into your MCP client.");
    return;
  }
  console.error(`${failed.length} check(s) need attention. Fix the FAIL lines above, then run npm run doctor again.`);
  process.exit(1);
}

main().catch((e) => {
  console.error("doctor crashed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
