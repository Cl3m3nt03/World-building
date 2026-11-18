import { expect, test } from "vitest";
import { loadAfterSaves, trackSave } from "./contentSaves";

function deferred() {
  let resolve: () => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

test("a load waits for the saves in progress, failed ones included", async () => {
  let text = "old";
  const first = deferred();
  const second = deferred();
  void trackSave(
    "doc-a",
    first.promise.then(() => {
      text = "new";
    }),
  ).catch(() => {});
  void trackSave("doc-a", second.promise).catch(() => {});

  const loaded = loadAfterSaves("doc-a", async () => text);
  first.resolve();
  second.reject(new Error("disk full"));
  expect(await loaded).toBe("new");
});

test("a load is read again when a save starts while it reads", async () => {
  let text = "old";
  const reads: string[] = [];
  const save = deferred();
  const loaded = loadAfterSaves("doc-b", async () => {
    const value = text;
    reads.push(value);
    if (reads.length === 1) {
      // A save starts while the first read is on its way.
      void trackSave(
        "doc-b",
        save.promise.then(() => {
          text = "new";
        }),
      );
      save.resolve();
    }
    return value;
  });
  expect(await loaded).toBe("new");
  expect(reads).toEqual(["old", "new"]);
});

test("the saves of another document do not hold a load", async () => {
  void trackSave("doc-c", new Promise(() => {}));
  expect(await loadAfterSaves("doc-d", async () => "read")).toBe("read");
});
