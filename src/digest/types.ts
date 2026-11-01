export type RunStatus = 'ok' | 'retry' | 'fail';

export interface DigestRow {
  job: string;
  /** Owner on the chronologically latest event; null remains visible as missing data. */
  owner: string | null;
  /** Number of valid events for this job, including retries and failures. */
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  /** Most recent nonempty error, retained after successful events. */
  lastError: string | null;
  /** Original timestamp strings, including their logged offsets. */
  firstAt: string;
  lastAt: string;
  /** True if any event failed, even when the latest event succeeded. */
  hasFailure: boolean;
}

/** Event totals across all valid records, not counts of jobs' final statuses. */
export interface DigestCounts {
  ok: number;
  retry: number;
  fail: number;
}

export interface NightDigest {
  night: string;
  /** One row per job, sorted by job using code-point order. */
  rows: DigestRow[];
  /** Malformed JSON or schema-invalid lines; blank lines are ignored. */
  badLines: number;
  counts: DigestCounts;
}

/**
 * readNight(runsDir, night) reads <runsDir>/<YYYY-MM-DD>.jsonl.
 * Missing files and invalid night names return null; an empty file returns an empty digest.
 * Other filesystem errors reject. Equal event timestamps use the later file line.
 */
export type ReadNight = (runsDir: string, night: string) => Promise<NightDigest | null>;
