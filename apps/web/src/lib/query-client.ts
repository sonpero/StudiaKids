import { QueryClient } from "@tanstack/react-query";
import { HttpError } from "./http-error.js";

const MAX_RETRIES = 1;

// One retry at most, never on a 404: a child reaches the error state (with
// its own « Réessaie ») after about a second, not after TanStack Query's
// default three retries (~7 s).
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof HttpError && error.status === 404) return false;
  return failureCount < MAX_RETRIES;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: shouldRetry } } });
}
