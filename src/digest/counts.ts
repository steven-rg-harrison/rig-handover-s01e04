import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RunStatus } from './types.js';

export type StatusCounts = Record<RunStatus, number>;

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

// Counts log lines per status; unparseable lines are skipped. `null` when the night has no file.
export function countNight(runsDir: string, night: string): StatusCounts | null {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const status: unknown = (JSON.parse(line) as { status?: unknown } | null)?.status;
      if (typeof status === 'string' && STATUSES.includes(status)) counts[status as RunStatus]++;
    } catch {
      // bad line: skipped
    }
  }
  return counts;
}
