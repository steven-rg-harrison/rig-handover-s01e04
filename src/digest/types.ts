// Contract for the morning digest (plan.md § 1). Section 2 builds against these types only.

export type RunStatus = 'ok' | 'retry' | 'fail';

/** One job's night, folded from every log line for that job. */
export type DigestRow = {
  job: string;
  /** `null` when the log says so; views render it as `—`. */
  owner: string | null;
  /** Log lines seen for this job. */
  runs: number;
  /** Lines with status `retry`. */
  retries: number;
  /** Status of the latest line by time. */
  lastStatus: RunStatus;
  /** Error of the latest line that had one, or `null`. */
  lastError: string | null;
  /** `at` exactly as logged, offset kept (styleguide: never convert to UTC). */
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  /** Rows sorted by job. */
  rows: DigestRow[];
  /** Lines that did not parse; counted, never thrown. */
  badLines: number;
};

/**
 * Reads `<runsDir>/<night>.jsonl`. Returns `null` when the night has no file
 * (routes answer 404); an empty file gives `rows: []`.
 */
export type ReadNight = (runsDir: string, night: string) => Night | null;
