import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from './read.js';

const runsDir = join(import.meta.dirname, '..', '..', 'runs');

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight(runsDir, '2026-10-28')!;
  const row = (job: string) => night.rows.find((r) => r.job === job)!;

  it('gives 5 jobs sorted by job and counts the 1 bad line', () => {
    expect(night.night).toBe('2026-10-28');
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('folds fixtures/refresh: 3 retries, ends ok, keeps last error', () => {
    expect(row('fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('keeps notes/backup as fail with its error', () => {
    expect(row('notes/backup')).toMatchObject({
      runs: 1,
      lastStatus: 'fail',
      lastError: 'quota exceeded',
    });
  });

  it('keeps digest/render with owner null', () => {
    expect(row('digest/render')).toMatchObject({ owner: null, runs: 1, lastError: null });
  });

  it('keeps at strings verbatim with offset', () => {
    expect(row('lane/sync')).toMatchObject({
      runs: 8,
      retries: 1,
      lastStatus: 'ok',
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
  });
});

describe('readNight edge nights', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('returns null for a missing night', () => {
    expect(readNight(dir, '1999-01-01')).toBeNull();
  });

  it('returns empty rows for an empty file', () => {
    writeFileSync(join(dir, 'empty.jsonl'), '');
    expect(readNight(dir, 'empty')).toEqual({ night: 'empty', rows: [], badLines: 0 });
  });

  it('counts lines with missing fields or invalid status as bad', () => {
    writeFileSync(
      join(dir, 'bad.jsonl'),
      [
        '{"at":"2026-10-29T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
        '{"at":"2026-10-29T01:00:00+01:00","job":"a","status":"weird","owner":"x"}',
        '{"job":"a","status":"ok","owner":"x"}',
        'not json',
      ].join('\n'),
    );
    const n = readNight(dir, 'bad')!;
    expect(n.badLines).toBe(3);
    expect(n.rows).toHaveLength(1);
  });

  it('picks the latest line by instant, not by string, across offsets', () => {
    writeFileSync(
      join(dir, 'tz.jsonl'),
      [
        '{"at":"2026-10-29T02:00:00+01:00","job":"a","status":"fail","owner":"x","error":"boom"}',
        '{"at":"2026-10-29T01:30:00Z","job":"a","status":"ok","owner":"x"}',
      ].join('\n'),
    );
    const r = readNight(dir, 'tz')!.rows[0]!;
    expect(r.lastStatus).toBe('ok');
    expect(r.lastAt).toBe('2026-10-29T01:30:00Z');
    expect(r.firstAt).toBe('2026-10-29T02:00:00+01:00');
    expect(r.lastError).toBe('boom');
  });
});
