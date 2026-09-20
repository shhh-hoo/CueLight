import { readFileSync, mkdirSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { performance } from 'node:perf_hooks';
import { loadEnv } from 'vite';
import { CueEngine, type DecisionRecord } from '../src/cue/cue-engine';
import { JevDecisionProvider } from '../src/decision/jev-decision-provider';
import { assertJevContext, buildJevRequest, JEV_CONTEXT_VERSION } from '../src/decision/jev-context';
import type { DecisionInput } from '../src/decision/decision-provider';
import type { CueDecision } from '../src/decision/types';
import type { Cue } from '../src/cue/types';
import type { EvidenceFragment } from '../src/evidence/evidence-buffer';

type Row = {
  index: number; input: DecisionInput; requestedAtMs: number; returnedAtMs?: number;
  providerDurationMs?: number; returned?: CueDecision; record?: DecisionRecord;
  currentCue?: Cue | null; appliedAtMs?: number; sourceReadyToCueStateMs?: number;
  latestInputToCueStateMs?: number; actualModel?: string; usage?: unknown; failure?: string;
};
const sha = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
const stamp = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${(ms / 1000 % 60).toFixed(3).padStart(6, '0')}`;
const quote = (text: string) => text.split('\n').map(line => `> ${line}`).join('\n');
const wait = (ms: number) => new Promise<void>(yes => setTimeout(yes, ms));

// Stream the diff: removing generated traces can exceed execFileSync's buffer.
function hashWorktreeDiff(): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const diff = spawn('git', ['diff', 'HEAD'], { stdio: ['ignore', 'pipe', 'inherit'] });
    diff.stdout.on('data', chunk => hash.update(chunk));
    diff.on('error', reject);
    diff.on('close', code => code === 0 ? resolve(hash.digest('hex')) : reject(new Error('Unable to read worktree diff.')));
  });
}

export async function main(args: string[]) {
  const { values } = parseArgs({ args, options: {
    live: { type: 'boolean', default: false },
    input: { type: 'string', default: 'evaluation/materials/transcript-map.json' },
    out: { type: 'string', default: 'artifacts/replay' },
    from: { type: 'string', default: '0' }, to: { type: 'string', default: '1822990' },
    mode: { type: 'string', default: 'semantic' },
    'env-dir': { type: 'string', default: '.' },
    'prefix-run': { type: 'string' },
  } });
  const from = Number(values.from), to = Number(values.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to <= from || !['semantic', 'paced'].includes(values.mode)) {
    throw new Error('Invalid range or mode.');
  }
  const raw = readFileSync(resolve(values.input));
  const corpus = JSON.parse(raw.toString()) as { fragments: EvidenceFragment[]; sourceUrl?: string; rawSha256?: string };
  // Original caption boundaries only. Never pass paragraphs, annotations, or future fragments to the engine.
  const fragments = corpus.fragments.filter(f => f.endMs >= from && f.endMs <= to)
    .map(({ id, text, startMs, endMs }) => ({ id, text, startMs, endMs }));
  if (!fragments.length) throw new Error('Empty range.');
  const env = loadEnv('development', resolve(values['env-dir']), ['TYPESAFE_', 'JEV_']);
  assertJevContext(env.JEV_CONTEXT_VERSION);
  const apiKey = env.TYPESAFE_API_KEY ?? '';
  if (values.live && !apiKey.trim()) throw new Error('Missing existing configuration.');
  const out = resolve(values.out);
  mkdirSync(dirname(out), { recursive: true });
  if (['.json', '.json.gz', '.jsonl', '.md'].some(ext => existsSync(`${out}${ext}`))) throw new Error('Use a new output path; runs are immutable.');
  const prefixFile = values['prefix-run'] ? readFileSync(resolve(values['prefix-run'])) : undefined;
  const prefixRaw = prefixFile && values['prefix-run']?.endsWith('.gz') ? gunzipSync(prefixFile) : prefixFile;
  const prefix = prefixRaw ? JSON.parse(prefixRaw.toString()) as { metadata: { inputSha256: string; mode: string }; rows: Row[] } : undefined;
  if (prefix && (prefix.metadata.inputSha256 !== sha(raw) || prefix.metadata.mode !== 'semantic' || values.mode !== 'semantic')) throw new Error('Prefix requires the same source and semantic mode.');
  const prefixRows = new Map(prefix?.rows.map(r => [r.input.evidence.fragments.at(-1)!.id, r]));
  let priming = false;
  const metadata = {
    createdAt: new Date().toISOString(), codeCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    worktreeDiffSha256: await hashWorktreeDiff(),
    engineSha256: sha(readFileSync('src/cue/cue-engine.ts')),
    contextSha256: sha(readFileSync('src/decision/jev-context.ts')),
    contextVersion: JEV_CONTEXT_VERSION, inputSha256: sha(raw), captionSha256: corpus.rawSha256,
    sourceUrl: corpus.sourceUrl, modelRequested: values.live ? env.JEV_MODEL || 'jev-latest' : 'offline-QUIET',
    live: values.live, mode: values.mode, from, to, fragmentCount: fragments.length,
    prefixRunSha256: prefixRaw ? sha(prefixRaw) : null,
    initialState: prefix ? 'reconstructed by same engine from archived decisions BEFORE range; timestamps re-created, no future decisions used' : 'empty',
    boundary: 'original MIT VTT captions, available at caption end; not Speechmatics Final',
    window: '20 seconds / 32 fragments; unchanged latest 1/2/3 + current-source-to-latest candidates',
    firstDisplayMeasurement: 'engine Cue-state publication proxy; browser paint, ASR and speech latency not measured',
  };
  writeFileSync(`${out}.jsonl`, JSON.stringify({ metadata }) + '\n');
  const started = performance.now();
  const now = () => performance.now() - started;
  const arrivals = new Map<string, number>();
  const rows: Row[] = [];
  let active: Row | undefined;
  let providerFailure: string | undefined;
  let wireModel: string | undefined;
  let wireUsage: unknown;
  const jev = new JevDecisionProvider({
    apiKey, model: env.JEV_MODEL,
    onError: message => { providerFailure = /^Jev HTTP \d{3}\.$/.test(message) || message === 'Jev request timed out.' ? message : 'Jev returned no usable decision.'; },
    transport: async (url, init) => {
      const response = await fetch(url, init);
      if (response.ok) {
        const data = await response.clone().json() as { model?: string; usage?: unknown };
        wireModel = typeof data.model === 'string' ? data.model : undefined;
        // Retain numeric usage only; never arbitrary upstream content.
        wireUsage = data.usage && typeof data.usage === 'object'
          ? Object.fromEntries(Object.entries(data.usage).filter(([, v]) => typeof v === 'number')) : undefined;
      }
      return response;
    },
  });
  const engine = new CueEngine({ decide: async input => {
    if (priming) {
      const archived = prefixRows.get(input.evidence.fragments.at(-1)!.id);
      if (!archived?.returned) throw new Error('Missing prefix decision.');
      return archived.returned;
    }
    active = { index: rows.length + 1, input, requestedAtMs: now() };
    const row = active;
    rows.push(row);
    appendFileSync(`${out}.jsonl`, JSON.stringify({ request: { index: row.index,
      body: buildJevRequest(input, env.JEV_MODEL).body } }) + '\n');
    providerFailure = undefined; wireModel = undefined; wireUsage = undefined;
    const result = values.live ? await jev.decide(input) : { action: 'QUIET' } as const;
    row.returnedAtMs = now(); row.providerDurationMs = row.returnedAtMs - row.requestedAtMs;
    row.returned = result; row.failure = providerFailure; row.actualModel = wireModel; row.usage = wireUsage;
    if (providerFailure) throw new Error(providerFailure);
    return result;
  } });
  let lastCue: Cue | null = null;
  let lastRecord: DecisionRecord | null = null;
  engine.subscribe(() => {
    const s = engine.getSnapshot();
    if (s.cues.currentCue !== lastCue && s.cues.currentCue && active) {
      active.appliedAtMs = now();
      const selectedEnd = s.cues.currentCue.sourceFragmentIds.at(-1)!;
      active.sourceReadyToCueStateMs = active.appliedAtMs - arrivals.get(selectedEnd)!;
      active.latestInputToCueStateMs = active.appliedAtMs - arrivals.get(active.input.evidence.fragments.at(-1)!.id)!;
    }
    lastCue = s.cues.currentCue;
    if (s.lastDecision && s.lastDecision !== lastRecord && active) {
      lastRecord = s.lastDecision; active.record = s.lastDecision; active.currentCue = s.cues.currentCue;
      appendFileSync(`${out}.jsonl`, JSON.stringify({ decision: active }) + '\n');
    }
  });
  const idle = async () => {
    while (engine.getSnapshot().status !== 'idle') await wait(2);
  };
  let accepted = 0;
  let interrupted = false;
  try {
    if (prefix) {
      priming = true;
      for (const fragment of corpus.fragments.filter(f => f.endMs < from)) {
        if (!prefixRows.has(fragment.id)) throw new Error('Incomplete prefix.');
        engine.accept(fragment); await idle();
        if (engine.getSnapshot().lastDecision?.outcome === 'fallback') throw new Error('Prefix no longer matches candidates.');
      }
      priming = false;
    }
    for (const fragment of fragments) {
      if (values.mode === 'paced') await wait(Math.max(0, fragment.endMs - from - now()));
      const arrivedAtMs = now(); arrivals.set(fragment.id, arrivedAtMs);
      appendFileSync(`${out}.jsonl`, JSON.stringify({ arrival: { fragment, arrivedAtMs } }) + '\n');
      engine.accept(fragment);
      if (engine.getSnapshot().inputError) throw new Error('Invalid source evidence.');
      accepted++;
      if (values.mode === 'semantic') await idle();
      if (accepted % 50 === 0) console.log(`${accepted}/${fragments.length} captions, ${rows.length} decisions`);
      if (rows.slice(-3).length === 3 && rows.slice(-3).every(r => r.failure)) { interrupted = true; break; }
    }
    await idle();
  } finally { engine.dispose(); }
  const percentile = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))] ?? null;
  const changes = rows.filter(r => r.record?.outcome === 'applied');
  const latencies = rows.map(r => r.providerDurationMs!);
  const displays = changes.map(r => r.sourceReadyToCueStateMs!);
  const summary = { accepted, decisions: rows.length, interrupted,
    outcomes: Object.fromEntries(['applied', 'quiet', 'discarded', 'fallback'].map(k => [k, rows.filter(r => r.record?.outcome === k).length])),
    actions: Object.fromEntries(['QUIET', 'NEW_CUE', 'UPDATE_CURRENT'].map(k => [k, rows.filter(r => r.returned?.action === k).length])),
    changesPerSourceMinute: changes.length / ((fragments.at(-1)!.endMs - fragments[0]!.startMs) / 60000),
    providerMs: { p50: percentile(latencies, .5), p95: percentile(latencies, .95), max: Math.max(...latencies) },
    sourceReadyToCueStateMs: { p50: percentile(displays, .5), p95: percentile(displays, .95) },
    elapsedMs: now(), cost: 'not supplied by provider; token usage retained when present',
  };
  writeFileSync(`${out}.json`, JSON.stringify({ metadata, summary, rows }, null, 2) + '\n');
  const md = [`# CueLight replay — ${values.mode}`, '', '## Run identity', '', '```json', JSON.stringify({ metadata, summary }, null, 2), '```', '',
    'Semantic mode waits after each caption: its timings are API / local publication observations, not real arrival scheduling or speech-to-screen latency. Paced mode uses original caption end times at 1×. Neither measures browser paint or Speechmatics Final.', '',
    'User and assistant annotations are separate offline references and are never sent to the model. Unmarked content is not automatically wrong.', ''];
  for (const row of rows) {
    const latest = row.input.evidence.fragments.at(-1)!;
    md.push(`## ${row.index} · ${stamp(latest.endMs)} · ${latest.id}`, '', '**Available evidence (oldest → latest)**', '');
    for (const f of row.input.evidence.fragments) md.push(`- ${f.id} · ${stamp(f.startMs)}–${stamp(f.endMs)}: ${f.text}`);
    md.push('', '**Current Cue before decision**', '', quote(row.input.currentCue?.text ?? '(none)'), '',
      `Sources: ${row.input.currentCue?.sourceFragmentIds.join(', ') ?? 'none'}`, '', '**Actual candidates**', '');
    row.input.candidates.forEach((c, i) => md.push(`- C${i} ${c.id}: ${c.text}`));
    md.push('', `**Jev returned:** ${JSON.stringify(row.returned)}${row.failure ? `; failure: ${row.failure}` : ''}`, '',
      `**Engine:** ${row.record?.outcome}; discard reason: ${row.record?.discardReason ?? 'none'}; provider ${row.providerDurationMs?.toFixed(1)} ms; source-ready → Cue-state ${row.sourceReadyToCueStateMs?.toFixed(1) ?? 'n/a'} ms.`, '',
      '**Current Cue after application**', '', quote(row.currentCue?.text ?? '(none)'), '', `Sources: ${row.currentCue?.sourceFragmentIds.join(', ') ?? 'none'}`, '');
  }
  writeFileSync(`${out}.md`, md.join('\n') + '\n');
  console.log(JSON.stringify({ output: `${out}.md`, summary }));
  if (interrupted || summary.outcomes.fallback) process.exitCode = 1;
}
