import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
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
    await expect(main([])).rejects.toThrow('Replay requires --input');
    await expect(main(['--context', 'baseline-v1'])).rejects.toThrow('Unknown option');
  } finally { log.mockRestore(); fetchSpy.mockRestore(); rmSync(dir, { recursive: true, force: true }); }
});

it.each(['annotations', 'decision records'])('keeps prefix %s out of the resumed request log', async check => {
  const dir = mkdtempSync(join(tmpdir(), 'cuelight-prefix-'));
  const input = join(dir, 'source.json'), prefix = join(dir, 'prefix'), out = join(dir, 'resumed');
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network call.'));
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    writeFileSync(input, JSON.stringify({ fragments: [
      { id: 'f1', text: 'First evidence.', startMs: 0, endMs: 1000, annotation: 'NEVER SEND THIS LABEL' },
      { id: 'f2', text: 'Second evidence.', startMs: 1000, endMs: 2000 },
    ] }));
    await main(['--input', input, '--out', prefix, '--env-dir', dir, '--to', '1000']);
    await main(['--input', input, '--out', out, '--env-dir', dir, '--from', '1500', '--to', '2000', '--prefix-run', `${prefix}.json`]);
    const trace = readFileSync(`${out}.jsonl`, 'utf8');
    const run = JSON.parse(readFileSync(`${out}.json`, 'utf8'));
    if (check === 'annotations') {
      expect(readFileSync(`${prefix}.jsonl`, 'utf8')).not.toContain('NEVER SEND THIS LABEL');
      expect(trace).not.toContain('NEVER SEND THIS LABEL');
      const request = trace.trim().split('\n').map(line => JSON.parse(line)).find(entry => entry.request).request;
      expect(request.body.state.backgroundEvidence).toEqual([{ id: 'f1', text: 'First evidence.', startMs: 0, endMs: 1000 }]);
    } else {
      const decisions = trace.trim().split('\n').map(line => JSON.parse(line)).filter(entry => entry.decision);
      expect(run.summary.decisions).toBe(1);
      expect(decisions).toHaveLength(1);
      expect(decisions[0].decision.input.evidence.version).toBe(2);
      expect(decisions[0].decision.record.input).toEqual(decisions[0].decision.input);
      expect(decisions[0].decision).toEqual(run.rows[0]);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally { log.mockRestore(); fetchSpy.mockRestore(); rmSync(dir, { recursive: true, force: true }); }
});

it('defaults to the actual end of a long source and only truncates with an explicit end', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cuelight-full-replay-'));
  const input = join(dir, 'source.json'), out = join(dir, 'full'), clipped = join(dir, 'clipped');
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    writeFileSync(input, JSON.stringify({ fragments: [
      { id: 'f1', text: 'First evidence.', startMs: 0, endMs: 1000 },
      { id: 'f2', text: 'Evidence after thirty-one minutes.', startMs: 1860000, endMs: 1861000 },
    ] }));
    await main(['--input', input, '--out', out, '--env-dir', dir]);
    const run = JSON.parse(readFileSync(`${out}.json`, 'utf8'));
    expect(run.summary.accepted).toBe(2);
    expect(run.metadata.to).toBe(1861000);
    expect(run.rows.at(-1).input.evidence.fragments.at(-1).id).toBe('f2');
    await main(['--input', input, '--out', clipped, '--env-dir', dir, '--to', '1000']);
    expect(JSON.parse(readFileSync(`${clipped}.json`, 'utf8')).summary.accepted).toBe(1);
  } finally { log.mockRestore(); rmSync(dir, { recursive: true, force: true }); }
});

it('exits nonzero for a timed-out paced request even when the engine discards its decision', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cuelight-paced-'));
  const input = join(dir, 'source.json'), out = join(dir, 'run');
  const priorExitCode = process.exitCode;
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  const now = vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
  vi.stubEnv('TYPESAFE_API_KEY', 'fake-replay-test-key');
  const fetchSpy = vi.spyOn(globalThis, 'fetch')
    .mockImplementationOnce(() => new Promise(() => {}))
    .mockImplementation(async (_url, init) => {
      const request = JSON.parse(init!.body as string);
      const body = { answers: { cue: { type: 'choice', choice: 'QUIET', confidence: 1,
        probabilities: Object.fromEntries(Object.keys(request.questions.cue.criteria).map(key => [key, key === 'QUIET' ? 1 : 0])) } } };
      return { ok: true, json: async () => body, clone() { return this; } } as Response;
    });
  try {
    process.exitCode = 0;
    writeFileSync(input, JSON.stringify({ fragments: [
      { id: 'f1', text: 'First evidence.', startMs: 0, endMs: 100 },
      { id: 'f2', text: 'Second evidence.', startMs: 100, endMs: 200 },
    ] }));
    const replay = main(['--input', input, '--out', out, '--env-dir', dir, '--live', '--mode', 'paced']);
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(200);
    // Model an event-loop delay beyond the engine's five-second acceptance bound.
    vi.setSystemTime(Date.now() + 1);
    await vi.advanceTimersByTimeAsync(5000);
    await replay;
    expect(existsSync(`${out}.md`)).toBe(true);
    const run = JSON.parse(readFileSync(`${out}.json`, 'utf8'));
    expect(run.rows[0].failure).toBe('Jev request timed out.');
    expect(run.rows[0].record.error).toBe('Jev request timed out.');
    expect(run.rows[0].record.discardReason).toBe('request-expired');
    expect(run.summary.outcomes).toEqual({ applied: 0, quiet: 1, discarded: 1, fallback: 0 });
    expect(run.summary.interrupted).toBe(false);
    expect(process.exitCode).toBe(1);
    expect(run.summary.failures).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  } finally {
    process.exitCode = priorExitCode;
    now.mockRestore(); vi.useRealTimers(); vi.unstubAllEnvs();
    log.mockRestore(); fetchSpy.mockRestore(); rmSync(dir, { recursive: true, force: true });
  }
});
