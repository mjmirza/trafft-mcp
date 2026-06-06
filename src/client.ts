/**
 * Trafft REST API client.
 *
 * Authentication. Trafft issues a Bearer token in exchange for client
 * credentials. The token is sent on every subsequent request and refreshed
 * automatically when the API returns 401.
 *
 * Note on credentials. Trafft's API setup page provides a Client ID and a
 * Client Secret. The token request body uses the field names `clientId` and
 * `clientSecret`. The Trafft API is in beta, so if your instance documents a
 * different token body, adjust the `authenticate` method below. See
 * docs/API.md for the full reference.
 */

const DEFAULT_TIMEOUT_MS = 30_000;

export class TrafftClient {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly timeoutMs: number;
  private token: string | null = null;

  constructor(opts: {
    apiUrl: string;
    clientId: string;
    clientSecret: string;
    apiPath?: string;
    timeoutMs?: number;
  }) {
    const root = opts.apiUrl.replace(/\/+$/, "");
    const path = (opts.apiPath ?? "/api/v1").replace(/\/+$/, "").replace(/^\/?/, "/");
    this.baseUrl = `${root}${path}`;
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Exchange client credentials for a Bearer token. */
  async authenticate(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/auth/token`, { // BESTPRACTICE_OK: AbortSignal.timeout passed in options below
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Trafft authentication failed (${res.status}). ${truncate(body)}`,
      );
    }
    const data = (await res.json()) as { token?: string; access_token?: string };
    const token = data.token ?? data.access_token;
    if (!token) {
      throw new Error("Trafft authentication returned no token field.");
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

    // Some delete endpoints return an empty body.
    const text = await res.text();
    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  get<T = unknown>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  post<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  put<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  delete<T = unknown>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}

function truncate(s: string, max = 300): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
}
