import { withBasePath } from "@/lib/base-path";

export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const resolvedInput = typeof input === "string" ? withBasePath(input) : input;

  const response = await fetch(resolvedInput, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? "Die Anfrage ist fehlgeschlagen.");
  }

  return payload as T;
}
