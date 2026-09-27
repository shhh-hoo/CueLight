// Frozen mock judgments for engineering regressions, never a semantic model.
import { buildSemanticRequest, operationCandidates, type OperationCandidate, type SemanticInput } from './inspection';
export function mockJudgmentResponse(input: SemanticInput, select: (candidate: OperationCandidate) => boolean,
  stance = 'asserted', relationEvidence = 'NONE', confidence = 0.73) {
  const candidate = operationCandidates(input).candidates.find(select);
  if (!candidate) throw new Error('Fixture target omitted from candidate coverage.');
  const request = buildSemanticRequest(input, 'jev-fixture');
  return { model: request.model, usage: { input_tokens: 100, output_tokens: 20 }, answers: Object.fromEntries(
    Object.entries(request.questions).map(([id, question]) => {
      const choice = id === 'operation' ? candidate.key : id === 'relationEvidence' ? relationEvidence : stance;
      return [id, { type: 'choice', choice, confidence,
        probabilities: Object.fromEntries(Object.keys(question.criteria).map(key => [key, key === choice ? 1 : 0])) }];
    })) };
}
