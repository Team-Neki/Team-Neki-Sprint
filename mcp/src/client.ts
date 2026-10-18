import type { Config } from "./config.js";
import { describeApiError } from "./format.js";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class SprintClient {
  constructor(
    private cfg: Config,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    // FormData 는 그대로 보내 fetch 가 multipart boundary 헤더를 붙이게 한다.
    const isForm = body instanceof FormData;
    const res = await this.fetchImpl(`${this.cfg.apiUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.cfg.token}`,
        ...(body && !isForm ? { "content-type": "application/json" } : {}),
      },
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });
    const json: unknown = await res.json().catch(() => null);
    const payload =
      json !== null && typeof json === "object" && !Array.isArray(json)
        ? (json as Record<string, unknown>)
        : null;
    if (!res.ok || payload?.ok === false) {
      const message =
        payload?.ok === false
          ? describeApiError(payload as never)
          : `HTTP ${res.status}`;
      throw new ApiError(res.status, message);
    }
    if (payload?.ok !== true || !("data" in payload)) {
      throw new ApiError(
        res.status,
        `Invalid API response (HTTP ${res.status}): expected { ok: true, data }`,
      );
    }
    return payload.data as T;
  }

  get<T>(path: string) {
    return this.request<T>("GET", path);
  }
  post<T>(path: string, body: unknown) {
    return this.request<T>("POST", path, body);
  }
  patch<T>(path: string, body: unknown) {
    return this.request<T>("PATCH", path, body);
  }
  del<T>(path: string) {
    return this.request<T>("DELETE", path);
  }
}
