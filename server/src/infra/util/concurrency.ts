/**
 * Runs `worker` over every item with at most `limit` in flight at once —
 * a small worker-pool, not a batch/chunk loop, so a handful of slow items
 * (e.g. unreachable IPs hitting their timeout) don't stall the whole run.
 */
export async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;

  async function runNext(): Promise<void> {
    const currentIndex = nextIndex++;
    if (currentIndex >= items.length) return;
    await worker(items[currentIndex]!);
    return runNext();
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runNext()));
}
