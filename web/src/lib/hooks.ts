"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { notifyError, notifySuccess } from "@/components/ui/notify";
import { api, ApiError, type Query, type ValidationErrors } from "@/lib/api";
import { createIdempotencyTracker, type IdempotencyTracker, requestFingerprint } from "@/lib/idempotency";

/** GET a resource collection/object; unwraps Laravel's { data } envelope. */
export function useApi<T>(path: string | null, query?: Query) {
  return useQuery({
    queryKey: [path, query],
    queryFn: () => api.get<{ data: T }>(path as string, query).then((response) => response.data),
    enabled: path !== null,
  });
}

type Method = "post" | "put" | "patch" | "delete";

/**
 * Mutation that shows the live-style success/error alert, exposes validation errors per field
 * and refreshes every cached query after success.
 *
 * Every call carries an `Idempotency-Key` header (spec §30): identical concurrent submits (double click) share one
 * request, a retry of the same request reuses the key so the API replays instead of posting twice, and the key rotates
 * after success ({@link createIdempotencyTracker}).
 */
export function useAction<TBody = unknown, TResult = unknown>(method: Method, path: string | ((body: TBody) => string), successMessage?: string | ((result: TResult) => string)) {
  const client = useQueryClient();
  const [errors, setErrors] = useState<ValidationErrors>({});
  const idempotency = useRef<IdempotencyTracker | null>(null);
  const lastResult = useRef<unknown>(null);

  const mutation = useMutation({
    mutationFn: (body: TBody) => {
      const target = typeof path === "function" ? path(body) : path;
      const payload = method === "delete" ? undefined : body;
      idempotency.current ??= createIdempotencyTracker();
      return idempotency.current.run(requestFingerprint(method, target, payload), (key) =>
        api[method]<TResult>(target, payload, { "Idempotency-Key": key }),
      );
    },
    onSuccess: async (result) => {
      setErrors({});
      // A double click resolves both calls with the same shared response: refresh and notify once.
      if (typeof result === "object" && result !== null && lastResult.current === result) {
        return;
      }
      lastResult.current = result;
      await client.invalidateQueries();
      const message = typeof successMessage === "function" ? successMessage(result) : successMessage ?? (result as { message?: string })?.message;
      if (message) {
        notifySuccess(message);
      }
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422) {
        setErrors(error.errors);
      }
      notifyError(error);
    },
  });

  const fieldError = (field: string) => errors[field]?.[0];

  return { ...mutation, errors, fieldError, setErrors };
}
