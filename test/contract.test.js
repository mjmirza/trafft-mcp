// Offline contract tests. No network, no credentials. Mocks global fetch and
// asserts the real request payloads, auth handshake, retry, parsing, size caps,
// https enforcement, and token-lean result shaping that CI could not see before.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TrafftClient } from "../build/client.js";
import { textResult, errorResult, buildQuery } from "../build/util.js";

const realFetch = globalThis.fetch;

// Install a scripted fetch. Each entry is { assert?, status, headers, body }.
function mockFetch(script) {
  const calls = [];
  let i = 0;
  globalThis.fetch = async (url, opts) => {
    const step = script[Math.min(i, script.length - 1)];
    i += 1;
    calls.push({ url: String(url), opts });
    if (step.assert) step.assert({ url: String(url), opts });
    const headers = new Map(Object.entries(step.headers ?? {}));
    return {
      ok: step.status >= 200 && step.status < 300,
      status: step.status,
      headers: { get: (k) => headers.get(k.toLowerCase()) ?? headers.get(k) ?? null },
      text: async () => step.body ?? "",
      json: async () => JSON.parse(step.body ?? "{}"),
    };
  };
  return calls;
}

function restore() { globalThis.fetch = realFetch; }

const base = { apiUrl: "https://demo.trafft.com", clientId: "id", clientSecret: "secret" };

test("authenticate posts an OAuth2 client-credentials form to /token", async () => {
  const calls = mockFetch([
    { status: 200, body: JSON.stringify({ access_token: "tok123" }),
      assert: ({ url, opts }) => {
        assert.ok(url.endsWith("/api/v2/token"), "hits /api/v2/token");
        assert.equal(opts.method, "POST");
        assert.equal(opts.headers["Content-Type"], "application/x-www-form-urlencoded");
        assert.match(opts.body, /grant_type=client_credentials/);
        assert.match(opts.body, /client_id=id/);
        assert.match(opts.body, /client_secret=secret/);
      } },
  ]);
  try {
    const c = new TrafftClient(base);
    await c.authenticate();
    assert.equal(calls.length, 1);
  } finally { restore(); }
});

test("a request sends the Bearer token and parses JSON", async () => {
  mockFetch([
    { status: 200, body: JSON.stringify({ access_token: "tok123" }) },
    { status: 200, body: JSON.stringify({ data: [{ id: 1 }] }),
      assert: ({ opts }) => assert.equal(opts.headers.Authorization, "Bearer tok123") },
  ]);
  try {
    const c = new TrafftClient(base);
    const r = await c.get("/customers");
    assert.deepEqual(r, { data: [{ id: 1 }] });
  } finally { restore(); }
});

test("a 401 re-authenticates once and retries the same request", async () => {
  const calls = mockFetch([
    { status: 200, body: JSON.stringify({ access_token: "old" }) },
    { status: 401, body: "" },
    { status: 200, body: JSON.stringify({ access_token: "new" }) },
    { status: 200, body: JSON.stringify({ ok: true }),
      assert: ({ opts }) => assert.equal(opts.headers.Authorization, "Bearer new") },
  ]);
  try {
    const c = new TrafftClient(base);
    const r = await c.get("/employees");
    assert.deepEqual(r, { ok: true });
    assert.equal(calls.length, 4);
  } finally { restore(); }
});

test("a non-JSON 200 throws instead of returning a proxy page", async () => {
  mockFetch([
    { status: 200, body: JSON.stringify({ access_token: "tok" }) },
    { status: 200, body: "<html>maintenance</html>" },
  ]);
  try {
    const c = new TrafftClient(base);
    await assert.rejects(() => c.get("/services"), /non-JSON response/);
  } finally { restore(); }
});

test("an empty body (204-style delete) resolves to an empty object", async () => {
  mockFetch([
    { status: 200, body: JSON.stringify({ access_token: "tok" }) },
    { status: 200, body: "" },
  ]);
  try {
    const c = new TrafftClient(base);
    assert.deepEqual(await c.delete("/customers/5"), {});
  } finally { restore(); }
});

test("an oversized declared content-length is rejected before buffering", async () => {
  mockFetch([
    { status: 200, body: JSON.stringify({ access_token: "tok" }) },
    { status: 200, headers: { "content-length": "99999999" }, body: "{}" },
  ]);
  try {
    const c = new TrafftClient({ ...base, maxBytes: 1000 });
    await assert.rejects(() => c.get("/customers"), /too large/);
  } finally { restore(); }
});

test("a non-error HTTP status surfaces the method, path and code", async () => {
  mockFetch([
    { status: 200, body: JSON.stringify({ access_token: "tok" }) },
    { status: 422, body: JSON.stringify({ message: "bad" }) },
  ]);
  try {
    const c = new TrafftClient(base);
    await assert.rejects(() => c.post("/coupons", {}), /POST \/coupons failed \(422\)/);
  } finally { restore(); }
});

test("http:// is refused so the client secret never leaves over plaintext", () => {
  assert.throws(() => new TrafftClient({ ...base, apiUrl: "http://demo.trafft.com" }), /https/);
});

test("localhost over http is allowed for local development", () => {
  assert.doesNotThrow(() => new TrafftClient({ ...base, apiUrl: "http://localhost:3000" }));
});

test("textResult keeps an empty data array so no-records is distinguishable", () => {
  const r = textResult({ data: [], pagination: { total: 0 } });
  assert.match(r.content[0].text, /"data":\[\]/);
});

test("textResult drops null, empty string and empty object but keeps real values", () => {
  const r = textResult({ a: null, b: "", c: {}, d: 0, e: "x" });
  const parsed = JSON.parse(r.content[0].text);
  assert.deepEqual(parsed, { d: 0, e: "x" });
});

test("buildQuery skips undefined, null and empty values", () => {
  assert.equal(buildQuery({ a: 1, b: undefined, c: null, d: "", e: "x" }), "?a=1&e=x");
  assert.equal(buildQuery({}), "");
});

test("errorResult marks the result as an error the model can read", () => {
  const r = errorResult(new Error("boom"));
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /boom/);
});
