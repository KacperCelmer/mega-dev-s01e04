import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DigestRow, NightDigest, ReadNight, RunStatus } from './types.js';

type RunEvent = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

type JobState = {
  row: DigestRow;
  firstTime: number;
  lastTime: number;
  errorTime: number;
};

function isRunEvent(value: unknown): value is RunEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.at === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(event.at) &&
    Number.isFinite(Date.parse(event.at)) &&
    // Date.parse accepts dates such as February 30 by rolling into the next month.
    new Date(event.at.slice(0, 10) + 'T00:00:00Z').toISOString().slice(0, 10) === event.at.slice(0, 10) &&
    typeof event.job === 'string' && event.job.trim().length > 0 &&
    (event.status === 'ok' || event.status === 'retry' || event.status === 'fail') &&
    (typeof event.owner === 'string' || event.owner === null) &&
    (event.error === undefined || typeof event.error === 'string')
  );
}

export const readNight: ReadNight = async (runsDir, night) => {
  if (night.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;

  let contents: string;
  try {
    contents = await readFile(join(runsDir, night + '.jsonl'), 'utf8');
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }

  const digest: NightDigest = { night, rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } };
  const jobs = new Map<string, JobState>();

  for (const line of contents.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      digest.badLines++;
      continue;
    }
    if (!isRunEvent(event)) {
      digest.badLines++;
      continue;
    }

    digest.counts[event.status]++;
    const time = Date.parse(event.at);
    let state = jobs.get(event.job);
    if (!state) {
      state = {
        row: {
          job: event.job,
          owner: event.owner,
          runs: 0,
          retries: 0,
          lastStatus: event.status,
          lastError: null,
          firstAt: event.at,
          lastAt: event.at,
          hasFailure: false,
        },
        firstTime: time,
        lastTime: time,
        errorTime: -Infinity,
      };
      jobs.set(event.job, state);
    }

    const row = state.row;
    row.runs++;
    if (event.status === 'retry') row.retries++;
    if (event.status === 'fail') row.hasFailure = true;
    if (time < state.firstTime) {
      state.firstTime = time;
      row.firstAt = event.at;
    }
    if (time >= state.lastTime) {
      state.lastTime = time;
      row.lastAt = event.at;
      row.lastStatus = event.status;
      row.owner = event.owner;
    }
    if (event.error?.trim() && time >= state.errorTime) {
      state.errorTime = time;
      row.lastError = event.error;
    }
  }

  digest.rows = [...jobs.keys()].sort().map((job) => jobs.get(job)!.row);
  return digest;
};
