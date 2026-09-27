import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallApiContextParams } from 'promptfoo';
import { buildSemanticRequest, operationCandidates, parseSemanticJudgment, validateSemanticInput } from '../../../src/alive/inspection.ts';
import { mockJudgmentResponse } from '../../../src/alive/inspection-fixtures.ts';
import { replayLesson } from '../../../src/alive/journal.ts';
import { inspectWithJev } from '../../../server/semantic-jev.ts';
import { JEV_ENDPOINT } from '../../../src/decision/jev-decision-provider.ts';
import { currentRevision } from '../../../src/alive/reducer.ts';
import CueLightProvider, { evaluateFixture } from './provider.ts';
import { constructFixture } from './fixtures.ts';
import promptfooTests, { cases, getCase } from './cases.ts';
import assertResult from './assertions.ts';

beforeEach(() => vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden in offline tests.'); })));
afterEach(() => vi.unstubAllGlobals());
const context = (caseId: string): CallApiContextParams => ({ vars: { caseId }, prompt: { raw: '{{caseId}}', label: 'fixture' } });
const enabled = { CUELIGHT_JEV_EVAL_LIVE: '1', TYPESAFE_API_KEY: 'offline-test-key', JEV_MODEL: 'jev-fixture' };
const decoded = (response: { output?: unknown }) => JSON.parse(String(response.output));

describe('curated fixtures and grading (authored judgments, not model-quality tests)', () => {
  it('keeps a small classified corpus, with exploratory observations outside semantic gates', () => {
    expect(cases.length).toBeGreaterThanOrEqual(15); expect(cases.length).toBeLessThanOrEqual(25);
    expect(new Set(cases.map(c => c.id)).size).toBe(cases.length);
    for (const test of promptfooTests()) {
      expect(test.metadata.principle).toBeTruthy(); expect(test.metadata.motivation).toBeTruthy();
      expect(test.metadata.severity).toMatch(/^P[0-3]$/);
      if (test.metadata.kind === 'exploratory') expect(test).not.toHaveProperty('assert');
      else expect(test.assert).toHaveLength(1);
    }
  });
  it.each(cases)('$id constructs, replays and compiles a legal authored result', async test => {
    const { input, store, cueIds } = constructFixture(test.fixture);
    expect(replayLesson(store.export())).toEqual(store.getSnapshot());
    const inspect = vi.fn(async captured => {
      expect(validateSemanticInput(captured)).toEqual(captured);
      const expected = test.expected;
      return parseSemanticJudgment(mockJudgmentResponse(captured, c =>
        (expected.allowed?.includes(c.action) ?? true) && (!expected.cueKey || c.cueId === cueIds[expected.cueKey]) &&
        (!expected.mode || c.mode === expected.mode) && (!expected.partId || c.partId === expected.partId) &&
        (!expected.relationKind || c.relationKind === expected.relationKind), expected.stance ?? 'asserted'), captured);
    });
    const result = await evaluateFixture(test.fixture, inspect);
    expect(result.error).toBeUndefined();
    const output = decoded(result);
    expect(assertResult(output, context(test.id)).pass).toBe(true);
    if (test.expected.outcome === 'coverage_blocked') {
      expect(inspect).not.toHaveBeenCalled(); expect(output.action).toBeNull(); expect(output).not.toHaveProperty('model');
    } else {
      expect(inspect).toHaveBeenCalledOnce();
      expect(output.sourceRanges).toEqual(expect.arrayContaining([expect.objectContaining({ evidenceId: 'source' })]));
      expect(assertResult({ ...output, outcome: 'provider_failure' }, context(test.id)).pass).toBe(test.metadata.kind === 'exploratory');
      if (test.expected.cueKey) expect(assertResult({ ...output, cueKey: 'wrong-cue' }, context(test.id)).pass).toBe(false);
    }
    const request = JSON.stringify(buildSemanticRequest(input));
    expect(request).not.toContain('motivation'); expect(request).not.toContain('severity'); expect(request).not.toContain('allowed');
  });
  it.each(['student-assertion', 'unknown-assertion'])('%s cannot expose mutation options', id => {
    const { input } = constructFixture(getCase(id).fixture);
    expect(operationCandidates(input).candidates.every(c => ['WAIT', 'NO_CHANGE', 'RECALL'].includes(c.action))).toBe(true);
  });
  it('preserves unrelated parts on replacement, and leaves offscreen revision out of foreground', async () => {
    const fixture = getCase('part-replacement').fixture;
    const { store, input, cueIds } = constructFixture(fixture);
    const { compileProposal } = await import('../../../src/alive/inspection.ts');
    const judgment = parseSemanticJudgment(mockJudgmentResponse(input, c => c.action === 'REVISE' && c.mode === 'replace' && c.partId === 'definition'), input);
    const oldCondition = currentRevision(store.getSnapshot().cues[cueIds.A!]!).parts[1];
    store.accept(compileProposal(input, judgment), 100);
    expect(currentRevision(store.getSnapshot().cues[cueIds.A!]!).parts[1]).toEqual(oldCondition);
    const oldFixture = getCase('return-with-new-meaning').fixture;
    const oldIds = constructFixture(oldFixture).cueIds;
    const result = await evaluateFixture(oldFixture, async i => parseSemanticJudgment(mockJudgmentResponse(i,
      c => c.action === 'REVISE' && c.mode === 'append' && c.cueId === oldIds.A), i));
    expect(result.error).toBeUndefined();
    expect(decoded(result)).toMatchObject({ action: 'REVISE', foregroundCueId: oldIds.B, cueId: oldIds.A });
    expect(decoded(result).foregroundCueId).not.toBe(decoded(result).cueId);
  });
  it('rejects malformed output, forbidden actions and false coverage success', () => {
    expect(assertResult('not-json', context('incomplete-condition')).pass).toBe(false);
    expect(assertResult({ outcome: 'accepted', action: 'CREATE', sourceRanges: [{}] }, context('student-assertion')).pass).toBe(false);
    expect(assertResult({ outcome: 'coverage_blocked', contextComplete: false, action: 'NO_CHANGE' }, context('required-target-omitted')).pass).toBe(false);
  });
});

describe('real custom provider with injected, network-free HTTP transport', () => {
  it.each([{ ...enabled, CI: 'true' }, { TYPESAFE_API_KEY: 'offline-test-key' }, { CUELIGHT_JEV_EVAL_LIVE: '1' }])('requires local live opt-in and credentials', async env => {
    const transport = vi.fn();
    const result = await new CueLightProvider({}, { env, transport }).callApi('', context('same-object-clarification'));
    expect(result.error).toBeTruthy(); expect(result.output).toBeUndefined(); expect(transport).not.toHaveBeenCalled();
  });
  it('uses the production HTTP endpoint, exact request, parser and accepted compiler result', async () => {
    const test = getCase('teacher-correction');
    const { input, cueIds } = constructFixture(test.fixture);
    const transport = vi.fn(async (url, init) => {
      expect(url).toBe(JEV_ENDPOINT);
      expect(JSON.parse(String(init?.body))).toEqual(JSON.parse(JSON.stringify(buildSemanticRequest(input, 'jev-fixture'))));
      return Response.json(mockJudgmentResponse(input, c => c.action === 'REVISE' && c.cueId === cueIds.A && c.mode === 'replace', 'asserted', 'NONE', 0.01));
    }) as unknown as typeof fetch;
    const result = await new CueLightProvider({}, { env: enabled, transport }).callApi('teacher-correction', context(test.id));
    expect(result.error).toBeUndefined(); expect(transport).toHaveBeenCalledOnce();
    expect(decoded(result)).toMatchObject({ action: 'REVISE', cueKey: 'A', cueRevision: 1, resultingCueRevision: 2, confidence: 0.01, model: 'jev-fixture' });
    expect(JSON.stringify(result)).not.toContain('offline-test-key');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it.each(['transport', 'http', 'malformed_response', 'invalid_choice'] as const)('%s stays a provider failure, never NO_CHANGE', async kind => {
    const { input } = constructFixture(getCase('same-object-clarification').fixture);
    const transport = vi.fn(async () => {
      if (kind === 'transport') throw new Error('offline-test-key');
      if (kind === 'http') return new Response('offline-test-key', { status: 403 });
      if (kind === 'malformed_response') return Response.json({ credentials: 'offline-test-key' });
      const raw = mockJudgmentResponse(input, c => c.action === 'WAIT'); raw.answers.operation!.choice = 'invented';
      return Response.json(raw);
    });
    const result = await new CueLightProvider({}, { env: enabled, transport }).callApi('', context('same-object-clarification'));
    expect(decoded(result)).toMatchObject({ outcome: 'provider_failure', action: null, failureKind: kind });
    expect(result.error).toBeTruthy(); expect(JSON.stringify(result)).not.toContain('offline-test-key');
    expect(transport).toHaveBeenCalledOnce();
  });
  it('required omissions make zero transport calls even in explicitly enabled mode', async () => {
    const transport = vi.fn();
    const result = await new CueLightProvider({}, { env: enabled, transport }).callApi('', context('required-target-omitted'));
    expect(decoded(result)).toMatchObject({ outcome: 'coverage_blocked', action: null }); expect(transport).not.toHaveBeenCalled();
  });
  it('timeout and malformed direct judgments remain failures', async () => {
    const fixture = getCase('incomplete-condition').fixture;
    const timeout = await evaluateFixture(fixture, i => inspectWithJev(i, { apiKey: 'offline', model: 'jev-fixture', timeoutMs: 1,
      transport: async () => new Promise(() => {}) }));
    expect(decoded(timeout)).toMatchObject({ action: null, outcome: 'provider_failure', failureKind: 'timeout' });
    const invalid = await evaluateFixture(fixture, async () => ({} as never));
    expect(decoded(invalid)).toMatchObject({ action: null, outcome: 'invalid_judgment' });
  });
});
