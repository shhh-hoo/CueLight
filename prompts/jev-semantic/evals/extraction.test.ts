import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { buildSemanticRequest } from '../../../src/alive/inspection.ts';
import { constructFixture, type LessonFixture } from './fixtures.ts';

// Frozen against main 316fc43 BEFORE extraction. Hash the full JSON request,
// including every dynamic criterion, alias, source, coverage field and instruction.
const cues = [
  { key: 'A', parts: [{ id: 'definition', text: 'A is X.' }, { id: 'condition', text: 'Only when Y.' }] },
  { key: 'B', parts: [{ id: 'definition', text: 'B is independent.' }] },
];
const fixtures: Record<string, LessonFixture> = {
  primary: { cues, tails: ['If that'], source: 'Use Z instead of X. B remains independent.' },
  student: { cues, role: 'student', source: 'Return to A.' },
  relation: { cues, source: 'A contrasts with B.', relationFrom: 'A' },
};
it.each(Object.entries(fixtures))('%s request matches the pre-extraction baseline', (name, fixture) => {
  const request = buildSemanticRequest(constructFixture(fixture).input);
  expect(createHash('sha256').update(JSON.stringify(request)).digest('hex')).toMatchSnapshot(`${name} full request`);
  expect(Object.fromEntries(Object.entries(request.questions).map(([key, q]) => [key, q.instructions])))
    .toMatchSnapshot(`${name} readable instructions`);
});
