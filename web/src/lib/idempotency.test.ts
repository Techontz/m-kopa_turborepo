import { describe, expect, it } from "vitest";

import { createIdempotencyTracker, IDEMPOTENCY_MISMATCH_MESSAGE, newIdempotencyKey, requestFingerprint } from "./idempotency";

function sequentialKeys() {
  let counter = 0;
  return () => `key-${++counter}`;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("newIdempotencyKey", () => {
  it("matches the API header format", () => {
    expect(newIdempotencyKey("action")).toMatch(/^[A-Za-z0-9._:-]{8,100}$/);
  });
});

describe("requestFingerprint", () => {
  it("is stable for the same request and differs for another body or path", () => {
    expect(requestFingerprint("post", "capital/floats", { amount: 1000 })).toBe(requestFingerprint("POST", "capital/floats", { amount: 1000 }));
    expect(requestFingerprint("post", "capital/floats", { amount: 1000 })).not.toBe(requestFingerprint("post", "capital/floats", { amount: 2000 }));
    expect(requestFingerprint("post", "payments/1/refund", { reason: "x" })).not.toBe(requestFingerprint("post", "payments/2/refund", { reason: "x" }));
  });

  it("describes FormData files by name and size", () => {
    const form = new FormData();
    form.append("amount", "5000");
    form.append("receipt", new File(["abc"], "slip.pdf"));
    expect(requestFingerprint("post", "capital", form)).toBe('POST capital [["amount","5000"],["receipt",{"file":"slip.pdf","size":3}]]');
  });
});

describe("createIdempotencyTracker", () => {
  it("shares one request and key between identical concurrent submits", async () => {
    const tracker = createIdempotencyTracker(sequentialKeys());
    const sent: string[] = [];
    const response = deferred<string>();
    const send = (key: string) => {
      sent.push(key);
      return response.promise;
    };

    const first = tracker.run("POST floats {1000}", send);
    const second = tracker.run("POST floats {1000}", send);
    response.resolve("ok");

    await expect(Promise.all([first, second])).resolves.toEqual(["ok", "ok"]);
    expect(sent).toEqual(["key-1"]);
  });

  it("rotates the key after a success so the next identical submit is a new request", async () => {
    const tracker = createIdempotencyTracker(sequentialKeys());
    const sent: string[] = [];
    const send = async (key: string) => {
      sent.push(key);
      return "ok";
    };

    await tracker.run("POST floats {1000}", send);
    expect(tracker.peek()).toBeNull();
    await tracker.run("POST floats {1000}", send);

    expect(sent).toEqual(["key-1", "key-2"]);
  });

  it("keeps the key when a failed request is retried unchanged", async () => {
    const tracker = createIdempotencyTracker(sequentialKeys());
    const sent: string[] = [];
    let attempt = 0;
    const send = async (key: string) => {
      sent.push(key);
      attempt += 1;
      if (attempt === 1) {
        throw Object.assign(new Error("Network error"), { status: 500 });
      }
      return "ok";
    };

    await expect(tracker.run("POST floats {1000}", send)).rejects.toThrow("Network error");
    await tracker.run("POST floats {1000}", send);

    expect(sent).toEqual(["key-1", "key-1"]);
  });

  it("uses a new key for a different request and after a key-mismatch 422", async () => {
    const tracker = createIdempotencyTracker(sequentialKeys());
    const sent: string[] = [];
    const failing = async (key: string) => {
      sent.push(key);
      throw Object.assign(new Error(IDEMPOTENCY_MISMATCH_MESSAGE), { status: 422 });
    };

    await expect(tracker.run("POST floats {1000}", failing)).rejects.toThrow(IDEMPOTENCY_MISMATCH_MESSAGE);
    expect(tracker.peek()).toBeNull();

    await expect(tracker.run("POST floats {1000}", failing)).rejects.toThrow();
    await expect(tracker.run("POST floats {2000}", failing)).rejects.toThrow();

    expect(sent).toEqual(["key-1", "key-2", "key-3"]);
  });

  it("does not rotate on an ordinary validation error", async () => {
    const tracker = createIdempotencyTracker(sequentialKeys());
    const send = async () => {
      throw Object.assign(new Error("The amount field is required."), { status: 422 });
    };

    await expect(tracker.run("POST floats {}", send)).rejects.toThrow();
    expect(tracker.peek()).toEqual({ key: "key-1", fingerprint: "POST floats {}" });
  });
});
