import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunStatus } from './types.js';

type LogLine = {
  at: string;
  ms: number;
  job: string;
  status: RunStatus;
  owner: string | null;
  error: string | null;
};

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parses one log line; `null` when it is not valid JSON or misses a required field. */
function parseLine(raw: string): LogLine | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  const { at, job, status, owner, error } = value;
  if (typeof at !== 'string' || typeof job !== 'string' || job === '') return null;
  if (typeof status !== 'string' || !STATUSES.includes(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && error !== null && typeof error !== 'string') return null;
  const ms = new Date(at).getTime();
  if (Number.isNaN(ms)) return null;
  return {
    at,
    ms,
    job,
    status: status as RunStatus,
    owner,
    error: typeof error === 'string' ? error : null,
  };
}

function fold(lines: LogLine[]): DigestRow {
  // Order by instant: `at` strings may carry different offsets, so string order is not time order.
  const sorted = [...lines].sort((a, b) => a.ms - b.ms);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const lastWithError = [...sorted].reverse().find((l) => l.error !== null);
  return {
    job: last.job,
    owner: last.owner,
    runs: sorted.length,
    retries: sorted.filter((l) => l.status === 'retry').length,
    lastStatus: last.status,
    lastError: lastWithError?.error ?? null,
    firstAt: first.at,
    lastAt: last.at,
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (err) {
    if (isRecord(err) && err.code === 'ENOENT') return null;
    throw err;
  }

  const byJob = new Map<string, LogLine[]>();
  let badLines = 0;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (line === null) {
      badLines += 1;
      continue;
    }
    const list = byJob.get(line.job);
    if (list) list.push(line);
    else byJob.set(line.job, [line]);
  }

  const rows = [...byJob.values()]
    .map(fold)
    .sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines };
};
