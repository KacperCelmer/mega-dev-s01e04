import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const night = '2026-10-28';
let runsDir: string;

beforeEach(async () => {
  runsDir = await mkdtemp(join(tmpdir(), 'rig-digest-routes-'));
});

afterEach(async () => {
  await rm(runsDir, { recursive: true, force: true });
});

const app = () => createApp({
  adapter: 'test',
  installed: '2026-10-28T00:00:00Z',
  beatEverySeconds: 60,
  runsDir,
});

async function writeNight(lines: string[]) {
  await writeFile(join(runsDir, `${night}.jsonl`), lines.join('\n'));
}

function event(job: string, at: string, status: 'ok' | 'retry' | 'fail', extra: Record<string, unknown> = {}) {
  return JSON.stringify({ job, at, status, owner: 'rook', ...extra });
}

describe('digest routes', () => {
  it('serves HTML and the exact shared digest shape from JSON', async () => {
    await writeNight([
      event('zeta', '2026-10-28T09:00:00-04:00', 'fail', { error: 'temporary failure' }),
      event('zeta', '2026-10-28T14:00:00Z', 'ok'),
      event('alpha', '2026-10-28T10:00:00+02:00', 'retry'),
      event('alpha', '2026-10-28T10:01:00+02:00', 'retry'),
      event('alpha', '2026-10-28T10:02:00+02:00', 'retry'),
      event('alpha', '2026-10-28T10:03:00+02:00', 'retry'),
      event('<script>alert(1)</script>', '2026-10-28T11:00:00+02:00', 'ok', {
        owner: '<img src=x onerror=alert(2)>', error: '<svg onload=alert(3)>',
      }),
      event('null-owner', '2026-10-28T12:00:00+02:00', 'ok', { owner: null }),
    ]);

    const apiResponse = await app().request(`/api/digest/${night}`);
    expect(apiResponse.status).toBe(200);
    const digest: unknown = await apiResponse.json();
    expect(digest).toEqual({
      night,
      badLines: 0,
      counts: { ok: 3, retry: 4, fail: 1 },
      rows: [
        {
          job: '<script>alert(1)</script>', owner: '<img src=x onerror=alert(2)>', runs: 1, retries: 0,
          lastStatus: 'ok', lastError: '<svg onload=alert(3)>',
          firstAt: '2026-10-28T11:00:00+02:00', lastAt: '2026-10-28T11:00:00+02:00', hasFailure: false,
        },
        {
          job: 'alpha', owner: 'rook', runs: 4, retries: 4, lastStatus: 'retry', lastError: null,
          firstAt: '2026-10-28T10:00:00+02:00', lastAt: '2026-10-28T10:03:00+02:00', hasFailure: false,
        },
        {
          job: 'null-owner', owner: null, runs: 1, retries: 0, lastStatus: 'ok', lastError: null,
          firstAt: '2026-10-28T12:00:00+02:00', lastAt: '2026-10-28T12:00:00+02:00', hasFailure: false,
        },
        {
          job: 'zeta', owner: 'rook', runs: 2, retries: 0, lastStatus: 'ok', lastError: 'temporary failure',
          firstAt: '2026-10-28T09:00:00-04:00', lastAt: '2026-10-28T14:00:00Z', hasFailure: true,
        },
      ],
    });

    const htmlResponse = await app().request(`/digest/${night}`);
    expect(htmlResponse.status).toBe(200);
    const html = await htmlResponse.text();
    const rowNames = ['&lt;script&gt;alert(1)&lt;/script&gt;', 'alpha', 'null-owner', 'zeta'];
    let previousPosition = -1;
    for (const name of rowNames) {
      const position = html.indexOf(name);
      expect(position).toBeGreaterThan(previousPosition);
      previousPosition = position;
    }
    expect(html).toContain('—');
    expect(html).toContain('4<span> · warning: 3 or more retries</span>');
    expect(html).toContain('ok<span> · warning: failed at least once</span>');
    expect(html).toContain('2026-10-28T09:00:00-04:00');
    expect(html).toContain('2026-10-28T14:00:00Z');
    expect(html).toContain('temporary failure');
    expect(html).toContain('&lt;img src=x onerror=alert(2)&gt;');
    expect(html).toContain('&lt;svg onload=alert(3)&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x onerror=alert(2)>');
    expect(html).not.toContain('<svg onload=alert(3)>');
  });

  it('returns 404 for a night with no file on both routes', async () => {
    expect((await app().request(`/digest/${night}`)).status).toBe(404);
    expect((await app().request(`/api/digest/${night}`)).status).toBe(404);
  });

  it('renders an empty night as nothing ran and returns empty JSON rows', async () => {
    await writeNight([]);
    const html = await app().request(`/digest/${night}`);
    expect(html.status).toBe(200);
    expect(await html.text()).toContain('nothing ran');

    const response = await app().request(`/api/digest/${night}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      night, rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('keeps valid rows and reports malformed lines on both routes', async () => {
    await writeNight([
      event('kept-job', '2026-10-28T08:00:00+01:00', 'ok'),
      '{ malformed json',
      JSON.stringify({ at: '2026-10-28T08:01:00+01:00', job: 'invalid-schema', status: 'ok' }),
    ]);

    const htmlResponse = await app().request(`/digest/${night}`);
    expect(htmlResponse.status).toBe(200);
    const html = await htmlResponse.text();
    expect(html).toContain('2 malformed lines in the run log.');
    expect(html).toContain('kept-job');
    expect(html).not.toContain('invalid-schema');

    const apiResponse = await app().request(`/api/digest/${night}`);
    expect(apiResponse.status).toBe(200);
    expect(await apiResponse.json()).toMatchObject({
      badLines: 2,
      rows: [{ job: 'kept-job', firstAt: '2026-10-28T08:00:00+01:00' }],
    });
  });
});
