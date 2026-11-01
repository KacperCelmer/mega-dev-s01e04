import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

const night = '2026-10-28';
const event = {
  at: '2026-10-29T01:00:00+01:00',
  job: 'test/job',
  owner: 'rook',
  status: 'ok',
};
let runsDir: string;

beforeEach(async () => { runsDir = await mkdtemp(join(tmpdir(), 'rig-reader-')); });
afterEach(async () => { await rm(runsDir, { recursive: true, force: true }); });

async function writeEvents(events: unknown[]) {
  await writeFile(join(runsDir, night + '.jsonl'), events.map((item) => JSON.stringify(item)).join('\n'));
}

describe('readNight', () => {
  it('reads the real fixture without changing it: five jobs and one bad line', async () => {
    const digest = await readNight('runs', night);
    expect(digest).not.toBeNull();
    expect(digest!.badLines).toBe(1);
    expect(digest!.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
    expect(digest!.rows.map((row) => row.job)).toEqual([
      'digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs',
    ]);
    expect(digest!.rows[0].owner).toBeNull();
    expect(digest!.rows[1]).toEqual({
      job: 'fixtures/refresh', owner: 'rook', runs: 4, retries: 3,
      lastStatus: 'ok', lastError: 'upstream 503', hasFailure: false,
      firstAt: '2026-10-29T01:30:00+01:00', lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(digest!.rows[2]).toMatchObject({ runs: 8, retries: 1, lastError: 'lock held' });
    expect(digest!.rows[3]).toMatchObject({ lastStatus: 'fail', hasFailure: true, lastError: 'quota exceeded' });
  });

  it('uses chronological instants across offsets, retains failures and the latest actual error', async () => {
    await writeEvents([
      { ...event, at: '2026-10-29T04:00:00+03:00', owner: null },
      { ...event, at: '2026-10-29T01:00:00+02:00', status: 'fail', error: 'old error' },
      { ...event, at: '2026-10-29T01:30:00+01:00', status: 'retry', error: 'latest error' },
      { ...event, at: '2026-10-29T01:15:00+01:00', status: 'retry', error: 'older error appearing later' },
      { ...event, at: '2026-10-29T01:45:00+01:00', status: 'retry', error: '  ' },
    ]);
    const digest = await readNight(runsDir, night);
    expect(digest!.rows).toEqual([{
      job: 'test/job', owner: null, runs: 5, retries: 3,
      lastStatus: 'ok', lastError: 'latest error', hasFailure: true,
      firstAt: '2026-10-29T01:00:00+02:00', lastAt: '2026-10-29T04:00:00+03:00',
    }]);
    expect(digest!.counts).toEqual({ ok: 1, retry: 3, fail: 1 });
  });

  it('uses later file lines to break equal timestamps', async () => {
    await writeEvents([
      { ...event, status: 'fail', error: 'first error' },
      { ...event, status: 'retry', error: 'second error' },
      { ...event, owner: null },
    ]);
    const digest = await readNight(runsDir, night);
    expect(digest!.rows[0]).toMatchObject({ owner: null, lastStatus: 'ok', lastError: 'second error', hasFailure: true });
  });

  it('counts malformed and invalid schema lines while continuing through valid records', async () => {
    const invalid = [null, [], {}, { ...event, owner: undefined }, { ...event, owner: 2 },
      { ...event, status: 'pending' }, { ...event, at: 'not a timestamp' },
      { ...event, at: '2026-10-29T01:00:00' }, { ...event, at: '2026-02-30T01:00:00Z' },
      { ...event, job: '  ' }, { ...event, error: 42 }];
    await writeFile(join(runsDir, night + '.jsonl'), [
      JSON.stringify(event), '{broken', ...invalid.map((item) => JSON.stringify(item)),
      '', '   ', JSON.stringify({ ...event, job: '__proto__', owner: null }), '',
    ].join('\r\n'));
    const digest = await readNight(runsDir, night);
    expect(digest!.badLines).toBe(invalid.length + 1);
    expect(digest!.rows.map((row) => row.job)).toEqual(['__proto__', 'test/job']);
    expect(digest!.counts).toEqual({ ok: 2, retry: 0, fail: 0 });
    expect(digest!.rows[0]).toMatchObject({ owner: null, lastError: null });
  });

  it('distinguishes missing files, empty files and files containing only invalid data', async () => {
    expect(await readNight(runsDir, night)).toBeNull();
    await writeFile(join(runsDir, night + '.jsonl'), '');
    expect(await readNight(runsDir, night)).toEqual({ night, rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } });
    await writeFile(join(runsDir, night + '.jsonl'), 'broken\n');
    expect(await readNight(runsDir, night)).toEqual({ night, rows: [], badLines: 1, counts: { ok: 0, retry: 0, fail: 0 } });
  });

  it('rejects unsafe night names before accessing files outside the runs directory', async () => {
    await mkdir(join(runsDir, 'nested'));
    await writeEvents([event]);
    for (const unsafe of ['../' + night, '..\\' + night, night + '.jsonl', '2026-1-1', night + '\n', '/2026-10-28']) {
      expect(await readNight(join(runsDir, 'nested'), unsafe)).toBeNull();
    }
  });

  it('does not disguise filesystem errors as missing nights', async () => {
    await mkdir(join(runsDir, night + '.jsonl'));
    await expect(readNight(runsDir, night)).rejects.toThrow();
  });
});
