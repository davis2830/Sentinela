export interface QueuedScan {
  task_id: string;
  resource_id: string;
  status: 'queued';
  submitted_at: string;
}

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function waitForFreshScan<T>(
  queued: QueuedScan,
  fetchResource: () => Promise<T>,
  getScanTimestamp: (resource: T) => string | null | undefined,
): Promise<T | null> {
  const submittedAt = new Date(queued.submitted_at).getTime();
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    await sleep(2_000);
    const resource = await fetchResource();
    const scanTimestamp = getScanTimestamp(resource);
    if (scanTimestamp && new Date(scanTimestamp).getTime() > submittedAt) return resource;
  }

  return null;
}
