import { expect, it } from 'vitest';
import { parsePresentationReply, presentationSchema, type PresentationBlock } from './presentation';

const text = (value = 'Teaching text.'): PresentationBlock => ({ kind: 'text', text: value });
const list = (count = 2): PresentationBlock => ({ kind: 'list', items: Array.from({ length: count }, (_, i) => ({ label: i ? 'Label' : null, text: `Fact ${i}` })) });
const chain = (count = 2): PresentationBlock => ({ kind: 'chain', nodes: Array.from({ length: count }, (_, i) => `Step ${i}`),
  links: Array.from({ length: count - 1 }, () => ({ kind: 'sequence', label: null })) });
const presentation = (...blocks: PresentationBlock[]) => ({ result: { kind: 'presentation', blocks } });

it.each([
  { result: { kind: 'source' } }, presentation(text()), presentation(list()), presentation(chain()),
  presentation(text(), chain()), presentation(text(), list(5), chain(4)),
  presentation({ kind: 'chain', nodes: ['A', 'B', 'C', 'D'], links: [
    { kind: 'causes', label: 'because' }, { kind: 'becomes', label: null }, { kind: 'moves_to', label: null },
  ] }),
])('accepts a complete V1 result: %j', value => {
  expect(parsePresentationReply(value)).toEqual(value);
});

it('keeps a root object, a nested union, required fields and no additional properties throughout the shared schema', () => {
  expect(presentationSchema.type).toBe('object');
  expect(presentationSchema.properties.result.anyOf).toHaveLength(2);
  function inspect(schema: unknown) {
    if (!schema || typeof schema !== 'object') return;
    const node = schema as Record<string, unknown>;
    if (node.type === 'object') {
      expect(node.additionalProperties).toBe(false);
      expect(new Set(node.required as string[])).toEqual(new Set(Object.keys(node.properties as object)));
    }
    Object.values(node).forEach(value => Array.isArray(value) ? value.forEach(inspect) : inspect(value));
  }
  inspect(presentationSchema);
});

it.each([
  null, [], {}, { kind: 'source' }, { result: { kind: 'source', blocks: [] } },
  { result: { kind: 'source' }, extra: true }, presentation(), presentation(text(), text(), text(), text()),
  presentation(list(0)), presentation(list(6)), presentation(chain(1)), presentation(chain(5)),
  { result: { kind: 'presentation', blocks: [{ kind: 'table', rows: [] }] } },
  { result: { kind: 'presentation', blocks: [{ kind: 'text', text: 'Fact', title: 'Title' }] } },
  { result: { kind: 'presentation', blocks: [{ kind: 'list', items: [{ text: 'Fact' }] }] } },
  { result: { kind: 'presentation', blocks: [{ kind: 'list', items: [{ label: null, text: 'Fact', source: 'f1' }] }] } },
  { result: { kind: 'presentation', blocks: [{ kind: 'chain', nodes: ['A', 'B', 'C'], links: [{ kind: 'sequence', label: null }] }] } },
  { result: { kind: 'presentation', blocks: [{ kind: 'chain', nodes: ['A', 'B'], links: [{ kind: 'sequence' }] }] } },
  { result: { kind: 'presentation', blocks: [{ kind: 'chain', nodes: ['A', 'B'], links: [{ kind: 'implies', label: null }] }] } },
  presentation(text('')), presentation(text('   ')), presentation(text('a'.repeat(281))),
])('rejects incomplete, invalid, additional or oversized fields without repair: %j', value => {
  expect(parsePresentationReply(value)).toBeNull();
});

it('counts Unicode code points for every string and label, including mixed-language content', () => {
  expect(parsePresentationReply(presentation(text('🧬'.repeat(280))))).not.toBeNull();
  expect(parsePresentationReply(presentation(text('🧬'.repeat(281))))).toBeNull();
  expect(parsePresentationReply(presentation(text('酶 activity 随 pH 改变。2 < 3; ATP → ADP.')))).not.toBeNull();
  for (const block of [
    { kind: 'list', items: [{ label: '🧬'.repeat(80), text: 'Fact' }] },
    { kind: 'chain', nodes: ['A', 'B'], links: [{ kind: 'sequence', label: '🧬'.repeat(80) }] },
  ] as PresentationBlock[]) expect(parsePresentationReply(presentation(block))).not.toBeNull();
  expect(parsePresentationReply(presentation({ kind: 'list', items: [{ label: '🧬'.repeat(81), text: 'Fact' }] }))).toBeNull();
  expect(parsePresentationReply(presentation({ kind: 'chain', nodes: ['A', '🧬'.repeat(281)], links: [{ kind: 'causes', label: null }] }))).toBeNull();
});

it('enforces the total visible budget across blocks, list labels, chain nodes and link labels', () => {
  const value = presentation(text('🧬'.repeat(280)), { kind: 'list', items: [
    { label: 'l'.repeat(80), text: 'a'.repeat(280) },
  ] }, { kind: 'chain', nodes: ['b'.repeat(280), 'c'.repeat(200)], links: [{ kind: 'causes', label: 'd'.repeat(80) }] });
  expect(parsePresentationReply(value)).not.toBeNull(); // exactly 1200 code points
  const oversized = structuredClone(value);
  const last = oversized.result.blocks[2];
  if (last?.kind === 'chain') last.nodes[1] += 'x';
  expect(parsePresentationReply(oversized)).toBeNull();
});

it.each(['<b>Fact</b>', '<svg />', '# Title', '- item', '**Fact**', '`Fact`', '[Fact](https://example.com)',
  '\\frac{1}{2}', '$x^2$', 'p { color: red; }'])('rejects generated markup: %s', value => {
  expect(parsePresentationReply(presentation(text(value)))).toBeNull();
});
