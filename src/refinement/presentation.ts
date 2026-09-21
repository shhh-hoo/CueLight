const textSchema = { type: 'string', minLength: 1, maxLength: 280 } as const;
const labelSchema = { type: ['string', 'null'], minLength: 1, maxLength: 80 } as const;

// The same schema is sent to OpenAI and checked at both HTTP boundaries.
export const presentationSchema = {
  type: 'object', additionalProperties: false, required: ['result'],
  properties: {
    result: { anyOf: [
      { type: 'object', additionalProperties: false, required: ['kind'],
        properties: { kind: { type: 'string', enum: ['source'] } } },
      { type: 'object', additionalProperties: false, required: ['kind', 'blocks'],
        properties: {
          kind: { type: 'string', enum: ['presentation'] },
          blocks: { type: 'array', minItems: 1, maxItems: 3, items: { anyOf: [
            { type: 'object', additionalProperties: false, required: ['kind', 'text'],
              properties: { kind: { type: 'string', enum: ['text'] }, text: textSchema } },
            { type: 'object', additionalProperties: false, required: ['kind', 'items'],
              properties: {
                kind: { type: 'string', enum: ['list'] },
                items: { type: 'array', minItems: 1, maxItems: 5, items: {
                  type: 'object', additionalProperties: false, required: ['label', 'text'],
                  properties: { label: labelSchema, text: textSchema },
                } },
              } },
            { type: 'object', additionalProperties: false, required: ['kind', 'nodes', 'links'],
              properties: {
                kind: { type: 'string', enum: ['chain'] },
                nodes: { type: 'array', minItems: 2, maxItems: 4, items: textSchema },
                links: { type: 'array', minItems: 1, maxItems: 3, items: {
                  type: 'object', additionalProperties: false, required: ['kind', 'label'],
                  properties: {
                    kind: { type: 'string', enum: ['sequence', 'causes', 'becomes', 'moves_to'] },
                    label: labelSchema,
                  },
                } },
              } },
          ] } },
        } },
    ] },
  },
} as const;

// Infer this contract directly; no second hand-maintained output shape or codegen step.
type SchemaValue<S> = S extends { enum: readonly (infer E)[] } ? E
  : S extends { anyOf: readonly (infer A)[] } ? SchemaValue<A>
  : S extends { type: 'object'; properties: infer P } ? { -readonly [K in keyof P]: SchemaValue<P[K]> }
  : S extends { type: 'array'; items: infer I } ? SchemaValue<I>[]
  : S extends { type: readonly ['string', 'null'] } ? string | null
  : S extends { type: 'string' } ? string : never;
export type PresentationReply = SchemaValue<typeof presentationSchema>;
export type PresentationResult = PresentationReply['result'];
export type PresentationBlock = Extract<PresentationResult, { kind: 'presentation' }>['blocks'][number];

type Schema = { type?: string | readonly string[]; enum?: readonly string[]; anyOf?: readonly Schema[];
  properties?: Record<string, Schema>; required?: readonly string[]; additionalProperties?: false;
  items?: Schema; minItems?: number; maxItems?: number; minLength?: number; maxLength?: number };
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const codePoints = (value: string) => Array.from(value).length;

function matchesSchema(value: unknown, schema: Schema): boolean {
  if (schema.anyOf) return schema.anyOf.some(option => matchesSchema(value, option));
  if (schema.enum) return typeof value === 'string' && schema.enum.includes(value);
  if (schema.type === 'object') {
    if (!record(value) || !schema.properties || !schema.required) return false;
    return schema.required.every(key => Object.hasOwn(value, key)) &&
      Object.keys(value).every(key => Object.hasOwn(schema.properties!, key) && matchesSchema(value[key], schema.properties![key]!));
  }
  if (schema.type === 'array') return Array.isArray(value) && value.length >= schema.minItems! &&
    value.length <= schema.maxItems! && value.every(item => matchesSchema(item, schema.items!));
  if (value === null) return Array.isArray(schema.type) && schema.type.includes('null');
  return typeof value === 'string' && !!value.trim() && codePoints(value) >= schema.minLength! && codePoints(value) <= schema.maxLength!;
}

// Strings are plain teaching content, never markup to interpret. Keep ordinary
// comparisons, chemical formulae and mixed-language text valid.
function plainText(value: string): boolean {
  return !/<\/?[a-z][^>]*>|<!--[\s\S]*?-->/i.test(value) &&
    !/`|\*\*|__|~~|!?\[[^\]]*\]\([^)]*\)/.test(value) &&
    !/(^|\n)\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s)/.test(value) &&
    !/\\(?:[a-z]+|[()[\]])|\$[^$]+\$/i.test(value) &&
    !/(?:^|[}\n])\s*(?:[.#][\w-]+|[a-z]+)\s*\{[^}]*:[^}]*\}/i.test(value);
}

export function parsePresentationReply(value: unknown): PresentationReply | null {
  if (!matchesSchema(value, presentationSchema)) return null;
  const reply = value as PresentationReply;
  if (reply.result.kind === 'source') return reply;
  const visible: string[] = [];
  for (const block of reply.result.blocks) {
    if (block.kind === 'text') visible.push(block.text);
    else if (block.kind === 'list') {
      for (const item of block.items) visible.push(item.label ?? '', item.text);
    } else {
      if (block.links.length !== block.nodes.length - 1) return null;
      visible.push(...block.nodes, ...block.links.map(link => link.label ?? ''));
    }
  }
  if (visible.reduce((sum, text) => sum + codePoints(text), 0) > 1200 || !visible.every(plainText)) return null;
  return reply;
}
