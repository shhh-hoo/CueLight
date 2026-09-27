import type { SemanticInput, SemanticAction } from '../src/alive/inspection';
import { mockJudgmentResponse } from '../src/alive/inspection-fixtures';
export function semanticReply(input: SemanticInput, action: SemanticAction = 'CREATE') {
  return { judgment: mockJudgmentResponse(input, c => c.action === action && c.source.alias === 'S1' &&
    (action !== 'REVISE' || c.mode === 'append')),
  configuration: { model: 'jev-test', timeoutMs: 5000, contextVersion: 'alive-jev-v1' } };
}
export const latestSourceId = (input: SemanticInput) => input.sources[0]!.ranges.at(-1)!.evidenceId;
export const replayReply = (input: SemanticInput) => semanticReply(input,
  latestSourceId(input) === 'science-2' || latestSourceId(input) === 'science-5' ? 'CREATE' : latestSourceId(input) === 'science-3' ? 'REVISE' : 'NO_CHANGE');
