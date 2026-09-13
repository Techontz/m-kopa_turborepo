"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { notifyError, notifySuccess } from "@/components/ui/notify";
import { api, ApiError, type Query, type ValidationErrors } from "@/lib/api";

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
 */
export function useAction<TBody = unknown, TResult = unknown>(method: Method, path: string | ((body: TBody) => string), successMessage?: string | ((result: TResult) => string)) {
  const client = useQueryClient();
  const [errors, setErrors] = useState<ValidationErrors>({});

  const mutation = useMutation({
    mutationFn: (body: TBody) => api[method]<TResult>(typeof path === "function" ? path(body) : path, method === "delete" ? undefined : body),
    onSuccess: async (result) => {
      setErrors({});
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
