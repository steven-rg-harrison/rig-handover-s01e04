import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

type Row = { job: string };
type NightJson = { night: string; rows: Row[]; badLines: number };

const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error ? { error } : {}) });

let runsDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));

  // Deliberately out of job order, to check sorting.
  writeFileSync(
    join(runsDir, '2030-01-01.jsonl'),
    [
      line('2030-01-01T23:00:01+01:00', 'zeta/sync', 'ok', 'lane-07'),
      line('2030-01-01T23:05:00+01:00', 'alpha/backup', 'retry', 'lane-07', 'timeout'),
      line('2030-01-01T23:10:00+01:00', 'alpha/backup', 'ok', 'lane-07'),
      line('2030-01-01T23:15:00+01:00', 'mid/clean', 'fail', null, 'disk full'),
    ].join('\n') + '\n',
  );

  writeFileSync(join(runsDir, '2030-01-02.jsonl'), '');

  writeFileSync(
    join(runsDir, '2030-01-03.jsonl'),
    [
      line('2030-01-03T23:00:01+01:00', 'beta/job', 'ok', 'lane-07'),
      line('2030-01-03T23:05:00+01:00', 'alpha/job', 'ok', 'lane-07'),
      '{"at":"2030-01-03T23:10:00+01:00","job":"gamma/jo',
    ].join('\n') + '\n',
  );

  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

const jobsInPage = (html: string) => {
  const found = [...html.matchAll(/(?:alpha|beta|mid|zeta)\/[a-z]+/g)].map((m) => m[0]);
  return [...new Set(found)];
};

describe('GET /digest/:night', () => {
  it('renders a table sorted by job', async () => {
    const res = await app.request('/digest/2030-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<table');
    expect(jobsInPage(html)).toEqual(['alpha/backup', 'mid/clean', 'zeta/sync']);
  });

  it('answers 404 when the night has no file', async () => {
    const res = await app.request('/digest/2030-12-31');
    expect(res.status).toBe(404);
  });

  it('says nothing ran for an empty file', async () => {
    const res = await app.request('/digest/2030-01-02');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('still renders when a line is bad', async () => {
    const res = await app.request('/digest/2030-01-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(jobsInPage(html)).toEqual(['alpha/job', 'beta/job']);
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the Night JSON', async () => {
    const res = await app.request('/api/digest/2030-01-01');
    const body = (await res.json()) as NightJson;
    expect(res.status).toBe(200);
    expect(body.night).toBe('2030-01-01');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/backup', 'mid/clean', 'zeta/sync']);
  });

  it('answers 404 when the night has no file', async () => {
    const res = await app.request('/api/digest/2030-12-31');
    expect(res.status).toBe(404);
  });

  it('returns rows [] for an empty file', async () => {
    const res = await app.request('/api/digest/2030-01-02');
    const body = (await res.json()) as NightJson;
    expect(res.status).toBe(200);
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('counts one bad line', async () => {
    const res = await app.request('/api/digest/2030-01-03');
    const body = (await res.json()) as NightJson;
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/job', 'beta/job']);
  });

  it('lists jobs in the same order as the page', async () => {
    const page = await (await app.request('/digest/2030-01-01')).text();
    const json = (await (await app.request('/api/digest/2030-01-01')).json()) as NightJson;
    expect(jobsInPage(page)).toEqual(json.rows.map((r) => r.job));
  });
});
