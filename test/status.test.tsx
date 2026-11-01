import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  it('shows the lane banner, digest link, and event counts', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('ok ');
    expect(html).toContain('retry ');
    expect(html).toContain('fail ');
  });

  it('links both nights on disk to rendering digest pages', async () => {
    const app = createApp(config);
    const board = await app.request('/');
    const html = await board.text();
    const nights = ['2026-10-28', '2026-10-27'];
    for (const night of nights) {
      expect(html).toContain('href="/digest/' + night + '"');
      const digest = await app.request('/digest/' + night);
      expect(digest.status).toBe(200);
    }
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});
