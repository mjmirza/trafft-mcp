#!/usr/bin/env node
/**
 * Endpoint auditor.
 *
 * Verifies that authentication works and that every Trafft endpoint the server
 * relies on is reachable and returns a valid response. Designed to run on a
 * schedule (for example monthly via GitHub Actions) so a silent API change,
 * an expired credential, or a feature toggle is caught early.
 *
 * Modes.
 *   default        Read only. Authenticates and probes every GET endpoint.
 *   --deep         Also round trips the write endpoints by creating a throwaway
 *                  test customer and coupon, then deleting them. Safe and self
 *                  cleaning, but it does write to your account briefly.
 *
 * Exit code is non zero if any required check fails, so CI marks the run red.
 * Feature gated endpoints (locations, coupons) that report disabled are
 * reported as skipped, not failed.
 */
import "dotenv/config";
import { TrafftClient } from "./client.js";

type Status = "PASS" | "FAIL" | "SKIP";
interface CheckResult {
  name: string;
  status: Status;
  detail: string;
}

const DEEP = process.argv.includes("--deep");

const apiUrl = process.env.TRAFFT_API_URL;
const clientId = process.env.TRAFFT_CLIENT_ID;
const clientSecret = process.env.TRAFFT_CLIENT_SECRET;
const apiPath = process.env.TRAFFT_API_PATH;

if (!apiUrl || !clientId || !clientSecret) {
  console.error("Missing TRAFFT_API_URL, TRAFFT_CLIENT_ID or TRAFFT_CLIENT_SECRET. See .env.example.");
  process.exit(1);
}

const client = new TrafftClient({ apiUrl, clientId, clientSecret, apiPath });
const results: CheckResult[] = [];

function isFeatureDisabled(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("403") || m.includes("feature") || m.includes("disabled") || m.includes("not enabled");
}

async function check(name: string, fn: () => Promise<unknown>, optional = false): Promise<unknown> {
  try {
    const data = await fn();
    results.push({ name, status: "PASS", detail: "ok" });
    return data;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (optional && isFeatureDisabled(msg)) {
      results.push({ name, status: "SKIP", detail: "feature not enabled on this account" });
      return undefined;
    }
    results.push({ name, status: "FAIL", detail: msg });
    return undefined;
  }
}

/** Read probe a path and classify reachability without throwing. */
async function probe(path: string): Promise<string> {
  try {
    await client.get(path);
    return "available";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = /\((\d{3})\)/.exec(msg)?.[1];
    if (code === "404") return "absent (404)";
    if (code === "403") return "gated (403)";
    if (code) return `error (${code})`;
    return "error";
  }
}

function firstId(payload: unknown): number | undefined {
  // Trafft list responses vary. Handle array, { data: [] }, { items: [] }.
  const arr = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown[] })?.data)
      ? (payload as { data: unknown[] }).data
      : Array.isArray((payload as { items?: unknown[] })?.items)
        ? (payload as { items: unknown[] }).items
        : [];
  const first = arr[0] as { id?: number } | undefined;
  return typeof first?.id === "number" ? first.id : undefined;
}

async function main(): Promise<void> {
  console.error(`trafft-mcp endpoint audit. mode ${DEEP ? "deep" : "read only"}. ${new Date().toISOString()}`);
  console.error(`target ${apiUrl}`);

  await check("auth /token", () => client.authenticate());

  await check("GET /customers", () => client.get("/customers?limit=1"));
  await check("GET /employees", () => client.get("/employees"));
  await check("GET /locations", () => client.get("/locations"), true);
  const services = await check("GET /services", () => client.get("/services"));
  await check("GET /appointments", () => client.get("/appointments?limit=1"));

  const serviceId = firstId(services);
  if (serviceId !== undefined) {
    await check(`GET /available-times (service ${serviceId})`, () =>
      client.get(`/available-times?service=${serviceId}`),
    );
  } else {
    results.push({
      name: "GET /available-times",
      status: "SKIP",
      detail: "no service id available to probe",
    });
  }

  if (DEEP) {
    const stamp = Date.now();
    const created = (await check("POST /customers (deep)", () =>
      client.post("/customers", {
        first_name: "MCP",
        last_name: `Audit ${stamp}`,
        email: `mcp.audit.${stamp}@example.com`,
        description: "Automated audit record. Safe to delete.",
      }),
    )) as { id?: number } | undefined;

    if (created?.id) {
      await check("GET /customers/{id} (deep)", () => client.get(`/customers/${created.id}`));
      // PATCH requires the full object (first_name, last_name, email, phone).
      await check("PATCH /customers/{id} (deep)", () =>
        client.patch(`/customers/${created.id}`, {
          first_name: "MCP",
          last_name: `Audit ${stamp}`,
          email: `mcp.audit.${stamp}@example.com`,
          phone: "",
          description: "Audit update ok",
        }),
      );
      await check("DELETE /customers/{id} (deep cleanup)", () =>
        client.delete(`/customers/${created.id}`),
      );
    }

    const coupon = (await check(
      "POST /coupons (deep)",
      () =>
        // The numeric limit fields must be present (null is accepted).
        client.post("/coupons", {
          code: `MCPAUDIT${stamp}`,
          discount_value: 1,
          usage_limit: 1,
          limit_per_user: null,
          booking_limit_amount: null,
        }),
      true,
    )) as { id?: number } | undefined;
    if (coupon?.id) {
      await check("DELETE /coupons/{id} (deep cleanup)", () => client.delete(`/coupons/${coupon.id}`), true);
    }
  }

  // Surface discovery. Read probes that map which endpoints this instance
  // exposes, including ones beyond the documented set. Informational only,
  // it never fails the run. This answers "what can we actually drive here".
  const candidates = [
    "/categories",
    "/service-categories",
    "/extras",
    "/custom-fields",
    "/customFields",
    "/webhooks",
    "/payments",
    "/taxes",
    "/packages",
    "/events",
    "/notifications",
    "/tags",
    "/currencies",
    "/settings",
    "/working-hours",
    "/schedules",
  ];
  const discovery: CheckResult[] = await Promise.all(
    candidates.map(async (path) => ({
      name: `GET ${path}`,
      status: "SKIP" as Status,
      detail: await probe(path),
    })),
  );

  // Report.
  const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - s.length));
  console.error("");
  console.error(`${pad("STATUS", 7)} ENDPOINT`);
  console.error("------- --------");
  for (const r of results) {
    const line = `${pad(r.status, 7)} ${pad(r.name, 36)} ${r.status === "PASS" ? "" : r.detail}`;
    console.error(line.trimEnd());
  }

  const failed = results.filter((r) => r.status === "FAIL");
  const passed = results.filter((r) => r.status === "PASS").length;
  const skipped = results.filter((r) => r.status === "SKIP").length;
  console.error("");
  console.error(`Summary. ${passed} passed, ${failed.length} failed, ${skipped} skipped.`);

  if (failed.length > 0) {
    console.error("Audit failed. One or more required endpoints did not respond correctly.");
    process.exit(1);
  }
  console.error("Audit passed.");
}

main().catch((e) => {
  console.error("Audit crashed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
