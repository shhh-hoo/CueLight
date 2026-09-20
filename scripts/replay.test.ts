import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { main } from './replay.ts';

it('replays only arrived source text through the engine, without labels/future input, and refuses to overwrite evidence', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cuelight-replay-'));
  const input = join(dir, 'source.json'), out = join(dir, 'run');
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    writeFileSync(input, JSON.stringify({ annotations: 'NEVER SEND THIS LABEL', fragments: [
      { id: 'f1', text: 'First evidence.', startMs: 0, endMs: 1000 },
      { id: 'f2', text: 'Second evidence.', startMs: 1000, endMs: 2000 },
      { id: 'f3', text: 'FUTURE TEXT', startMs: 2000, endMs: 3000 },
    ] }));
    await main(['--input', input, '--out', out, '--to', '2000']);
    const run = JSON.parse(readFileSync(`${out}.json`, 'utf8'));
    expect(run.summary.accepted).toBe(2);
    expect(run.metadata.contextVersion).toBe('structured-v3');
    expect(run.rows[0].input.evidence.fragments.map((f: { id: string }) => f.id)).toEqual(['f1']);
    expect(run.rows[1].input.evidence.fragments.map((f: { id: string }) => f.id)).toEqual(['f1', 'f2']);
    const trace = readFileSync(`${out}.jsonl`, 'utf8');
    expect(trace).not.toContain('FUTURE TEXT');
    expect(trace).not.toContain('NEVER SEND THIS LABEL');
    expect(fetchSpy).not.toHaveBeenCalled();
    await expect(main(['--input', input, '--out', out, '--to', '2000'])).rejects.toThrow('immutable');
    await expect(main(['--context', 'baseline-v1'])).rejects.toThrow('Unknown option');
  } finally { log.mockRestore(); fetchSpy.mockRestore(); rmSync(dir, { recursive: true, force: true }); }
});
