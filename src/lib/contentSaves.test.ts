import { afterEach, expect, test, vi } from "vitest";
import { type ContentCache, isTracked, loadAfterSaves, saveContent } from "./contentSaves";

function deferred<T = void>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** A cache holding one text, as react-query would. */
function memoryCache(initial: string | undefined) {
  const cache = {
    text: initial,
    reloads: 0,
    read: () => cache.text,
    write: (text: string) => {
      cache.text = text;
    },
    reload: () => {
      cache.reloads += 1;
    },
  };
  return cache satisfies ContentCache<string>;
}

/** Lets the settled saves' handlers run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.useRealTimers();
});

test("a save is in the cache as it starts, and stays there once done", async () => {
  const cache = memoryCache("old");
  const sent = deferred();
  const save = saveContent("doc-start", "new", cache, () => sent.promise);
  expect(cache.text).toBe("new");
  sent.resolve();
  await save;
  await settle();
  expect(cache.text).toBe("new");
  expect(isTracked("doc-start")).toBe(false);
});

test("a failed save puts back the last saved text", async () => {
  const cache = memoryCache("old");
  const sent = deferred();
  const save = saveContent("doc-fail", "new", cache, () => sent.promise).catch(() => {});
  sent.reject(new Error("disk full"));
  await save;
  await settle();
  expect(cache.text).toBe("old");
});

test("a failed save keeps the text of a later save in the cache", async () => {
  const cache = memoryCache("old");
  const first = deferred();
  const second = deferred();
  const a = saveContent("doc-later", "A", cache, () => first.promise).catch(() => {});
  void saveContent("doc-later", "B", cache, () => second.promise);
  first.reject(new Error("disk full"));
  await a;
  await settle();
  expect(cache.text).toBe("B");
  second.resolve();
});

test("a failed save followed by the same text saved: the cache holds what was saved", async () => {
  // The same text twice (a letter typed then removed): compared by content,
  // the first save's failure would take the second one's text for its own.
  const cache = memoryCache("old");
  const first = deferred();
  const second = deferred();
  const a = saveContent("doc-same", "new", cache, () => first.promise).catch(() => {});
  const b = saveContent("doc-same", "new", cache, () => second.promise);
  first.reject(new Error("disk full"));
  await a;
  second.resolve();
  await b;
  await settle();
  expect(cache.text).toBe("new");
});

test("two failed saves in a row put back the text saved before them", async () => {
  const cache = memoryCache("old");
  const first = deferred();
  const second = deferred();
  const a = saveContent("doc-twice", "A", cache, () => first.promise).catch(() => {});
  const b = saveContent("doc-twice", "B", cache, () => second.promise).catch(() => {});
  first.reject(new Error("disk full"));
  await a;
  second.reject(new Error("disk full"));
  await b;
  await settle();
  expect(cache.text).toBe("old");
});

test("a save that succeeds before a later one fails becomes the text put back", async () => {
  const cache = memoryCache("old");
  const first = deferred();
  const second = deferred();
  const a = saveContent("doc-confirmed", "A", cache, () => first.promise);
  const b = saveContent("doc-confirmed", "B", cache, () => second.promise).catch(() => {});
  first.resolve();
  await a;
  second.reject(new Error("disk full"));
  await b;
  await settle();
  expect(cache.text).toBe("A");
});

test("a failed save with nothing known before reads the document again", async () => {
  const cache = memoryCache(undefined);
  const sent = deferred();
  const save = saveContent("doc-unknown", "new", cache, () => sent.promise).catch(() => {});
  sent.reject(new Error("disk full"));
  await save;
  await settle();
  expect(cache.reloads).toBe(1);
});

test("a load waits for the saves in progress, failed ones included", async () => {
  let stored = "old";
  const cache = memoryCache("old");
  const first = deferred();
  const second = deferred();
  void saveContent("doc-wait", "new", cache, () =>
    first.promise.then(() => {
      stored = "new";
    }),
  );
  void saveContent("doc-wait", "newer", cache, () => second.promise).catch(() => {});

  const loaded = loadAfterSaves("doc-wait", async () => stored);
  first.resolve();
  second.reject(new Error("disk full"));
  expect(await loaded).toBe("new");
  await settle();
  expect(isTracked("doc-wait")).toBe(false);
});

test("a load is read again when a save starts while it reads", async () => {
  let stored = "old";
  const reads: string[] = [];
  const cache = memoryCache("old");
  const loaded = loadAfterSaves("doc-reread", async () => {
    const value = stored;
    reads.push(value);
    if (reads.length === 1) {
      // A save starts while the first read is on its way.
      void saveContent("doc-reread", "new", cache, async () => {
        stored = "new";
      });
    }
    return value;
  });
  expect(await loaded).toBe("new");
  expect(reads).toEqual(["old", "new"]);
});

test("a stuck save holds a load for the time limit only", async () => {
  vi.useFakeTimers();
  const cache = memoryCache("old");
  void saveContent("doc-stuck", "new", cache, () => new Promise(() => {}));
  const done = vi.fn();
  void loadAfterSaves("doc-stuck", async () => "read", 3000).then(done);
  await vi.advanceTimersByTimeAsync(2999);
  expect(done).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(done).toHaveBeenCalledWith("read");
});

test("the saves of another document do not hold a load", async () => {
  void saveContent("doc-c", "x", memoryCache("old"), () => new Promise(() => {}));
  expect(await loadAfterSaves("doc-d", async () => "read")).toBe("read");
});
