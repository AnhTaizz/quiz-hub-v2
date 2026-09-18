import type { ApiError } from "@/types/api";
import { clearSession, getToken } from "@/auth/authStorage";

// The one place components/hooks are allowed to reach the network through
// (see docs/frontend/REACT_MIGRATION.md - "API architecture"). Centralizes
// base URL, JSON handling, Authorization injection, 401/403 handling, error
// normalization, and AbortSignal passthrough so no component ever touches
// raw fetch()/Response objects - the pattern the audit found scattered
// across ~27 legacy page scripts (JS architecture, api-client.js adoption).

const BASE_URL = "/api";

type Method = "GET" | "POST" | "PUT" | "DELETE";

interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** multipart/form-data upload; when set, `body` is ignored and no JSON Content-Type is sent. */
  formData?: FormData;
}

let onUnauthorized: (() => void) | null = null;

/** Registered once by AuthProvider so httpClient can react to a 401 without importing React state directly. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(BASE_URL + path, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.pathname + url.search;
}

async function parseErrorBody(response: Response): Promise<Partial<ApiError>> {
  try {
    const data = (await response.json()) as Record<string, unknown>;
    return {
      code: typeof data.code === "number" ? data.code : undefined,
      message: typeof data.message === "string" ? data.message : undefined,
      errors: (data.errors as Record<string, string> | undefined) ?? undefined,
    };
  } catch {
    return {};
  }
}

async function request<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body,
      signal: options.signal,
      credentials: "same-origin",
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    const networkError: ApiError = {
      status: 0,
      message: "Network error - please check your connection.",
    };
    throw networkError;
  }

  if (response.status === 401) {
    clearSession();
    onUnauthorized?.();
    const errorBody = await parseErrorBody(response);
    const error: ApiError = { status: 401, message: "Session expired.", ...errorBody };
    throw error;
  }

  if (!response.ok) {
    const errorBody = await parseErrorBody(response);
    const error: ApiError = {
      status: response.status,
      message: errorBody.message ?? `Request failed (${response.status})`,
      code: errorBody.code,
      errors: errorBody.errors,
    };
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return (await response.text()) as unknown as T;
}

export const httpClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, "body" | "formData">) =>
    request<T>("GET", path, options),
  post: <T>(path: string, options?: RequestOptions) => request<T>("POST", path, options),
  put: <T>(path: string, options?: RequestOptions) => request<T>("PUT", path, options),
  delete: <T>(path: string, options?: Omit<RequestOptions, "body" | "formData">) =>
    request<T>("DELETE", path, options),
};

export function isApiError(value: unknown): value is ApiError {
  return typeof value === "object" && value !== null && "status" in value && "message" in value;
}
