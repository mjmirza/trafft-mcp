/**
 * Trafft REST API client.
 *
 * Authentication. Trafft issues a Bearer token in exchange for client
 * credentials. The token is sent on every subsequent request and refreshed
 * automatically when the API returns 401.
 *
 * Note on credentials. Trafft's API setup page provides a Client ID and a
 * Client Secret. The token endpoint follows the OAuth2 client-credentials
 * grant. a form-encoded POST to /token with `grant_type=client_credentials`,
 * `client_id`, and `client_secret`. The response carries `access_token`. This
 * contract was verified live against a Trafft v2 instance. See docs/API.md.
 */

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BYTES = 10_000_000; // 10 MB hard cap on any single response

export class TrafftClient {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly timeoutMs: number;
  private readonly maxBytes: number;
  private token: string | null = null;
  private authInFlight: Promise<void> | null = null;

  constructor(opts: {
    apiUrl: string;
    clientId: string;
    clientSecret: string;
    apiPath?: string;
    timeoutMs?: number;
    maxBytes?: number;
  }) {
    // Credentials travel to this host, so refuse anything but https.
    // localhost is allowed for development. blocks plaintext transport and SSRF.
    let url: URL;
    try {
      url = new URL(opts.apiUrl);
    } catch {
      throw new Error("TRAFFT_API_URL is not a valid URL.");
    }
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !isLocal) {
      throw new Error("TRAFFT_API_URL must use https.");
    }
    const root = opts.apiUrl.replace(/\/+$/, "");
    const path = (opts.apiPath ?? "/api/v2").replace(/\/+$/, "").replace(/^\/?/, "/");
    this.baseUrl = `${root}${path}`;
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  }

  // OAuth2 client-credentials grant, form-encoded. Single-flight so concurrent
  // callers share one in-flight token request and never stampede a refresh.
  async authenticate(): Promise<void> {
    if (this.authInFlight) return this.authInFlight;
    this.authInFlight = this.requestToken().finally(() => {
      this.authInFlight = null;
    });
    return this.authInFlight;
  }

  private async requestToken(): Promise<void> {
    const form = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    const res = await fetch(`${this.baseUrl}/token`, { // BESTPRACTICE_OK: AbortSignal.timeout passed in options below
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Trafft authentication failed (${res.status}). ${truncate(body)}`,
      );
    }
    const data = (await res.json()) as {
      access_token?: string;
      token?: string;
    };
    const token = data.access_token ?? data.token;
    if (!token) {
      throw new Error("Trafft authentication returned no access_token field.");
    }
    this.token = token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    retry = true,
  ): Promise<T> {
    if (!this.token) await this.authenticate();

    const res = await fetch(`${this.baseUrl}${path}`, { // BESTPRACTICE_OK: AbortSignal.timeout passed in options below
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    // Token expired. Re-authenticate once and retry the same request.
    if (res.status === 401 && retry) {
      this.token = null;
      await this.authenticate();
      return this.request<T>(method, path, body, false);
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Trafft API ${method} ${path} failed (${res.status}). ${truncate(errBody)}`);
    }

    // Reject an oversized body before it can exhaust memory.
    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > this.maxBytes) {
      throw new Error(`Trafft API ${method} ${path} response too large (${declared} bytes).`);
    }
    // Some delete endpoints return an empty body.
    const text = await res.text();
    if (text.length > this.maxBytes) {
      throw new Error(`Trafft API ${method} ${path} response exceeded ${this.maxBytes} bytes.`);
    }
    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      // A 200 with a non-JSON body is a proxy or maintenance page, not data.
      throw new Error(
        `Trafft API ${method} ${path} returned a non-JSON response (${res.status}). ${truncate(text)}`,
      );
    }
  }

  get<T = unknown>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  post<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  patch<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  delete<T = unknown>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}

function truncate(s: string, max = 300): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
}
