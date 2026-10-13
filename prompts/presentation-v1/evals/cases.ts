import { projectCue } from '../../../src/alive/projection.ts';
import { presentationInput } from '../../../src/refinement/input.ts';
import { constructFixture } from '../../jev-semantic/evals/fixtures.ts';

export type PresentationCase = { id: string; source: string; context?: string; partial?: boolean;
  review: string; family: string; sourceKind: 'authored'; use: 'development' | 'regression';
  path: 'current-whole-final' | 'blocked-whole-final'; };
const rows = [
  ['numbers-units', '温度是 20 °C，体积是 5 mL。', '数值、单位均保留；source 安全但并不证明改进有用。', 'quantities'],
  ['negative-condition', '只有 Y 成立时 A 才适用；不是所有 X 都满足 Y。', '不得丢掉只有、否定或量词。', 'qualification'],
  ['positive-condition-pair', '即使 Y 不成立，A 也适用。', '与上一例形成反例：不得套用只有 Y 的限制。', 'qualification'],
  ['uncertainty', '这可能是扩散，但测量还不能确定。', '保留可能与不能确定；不能升级成断言。', 'stance'],
  ['comparison', 'A 比 B 小；B 不是 A 的两倍。', '保留比较方向及否定，不能倒转。', 'comparison'],
  ['question', '为什么水会向低处流？', '保持问题，不补答案。', 'role'],
  ['quoted-example', '错误例子：“所有金属都能被磁铁吸住。”这句话不成立。', '被批评的例子不是教师认可的事实。', 'role'],
  ['bilingual', '这个过程叫 diffusion，也就是扩散，不是 convection。', '不翻译或删掉任一语言；保留否定。', 'language'],
  ['context-boundary', '它会改变。', '必要指代可消歧；不能把背景的新教学点带入正文。', 'context'],
  ['sequence', '先加水，再加盐，最后搅拌。', '时间顺序不能升级成 causes。', 'relation'],
  ['explicit-cause-pair', '升温明确导致反应加速，但仅限这个实验条件。', '因果可表达但保留范围；不能把所有链都降为无条件事实。', 'relation'],
  ['long-source', '每个步骤都需要保留自己的条件、单位和不确定性。'.repeat(70), '完整内容超出展示预算时 source fallback；不得截断。', 'length'],
  ['partial-final', 'A 是 X。B 是 Y。', '只选择 Final 的子段时当前调度阻止调用，不能计为模型失败。', 'eligibility'],
] as const;
export const cases: PresentationCase[] = rows.map(([id, source, review, family]) => ({ id, source, review, family,
  sourceKind: 'authored', use: 'development', path: id === 'partial-final' ? 'blocked-whole-final' : 'current-whole-final',
  ...(id === 'context-boundary' ? { context: '扩散速度受到温度影响。另一个教学点：容器的颜色是蓝色。' } : {}),
  ...(id === 'partial-final' ? { partial: true } : {}),
}));
export function constructPresentationFixture(test: PresentationCase) {
  const { store, cueIds } = constructFixture({ source: 'Unprocessed later evidence.', cues: [
    ...(test.context ? [{ key: 'context', parts: [{ id: 'body', text: test.context }] }] : []),
    { key: 'selected', parts: [{ id: 'body', text: test.source }] },
  ] });
  const state = store.getSnapshot();
  const cue = projectCue(state, cueIds.selected!)!;
  // A partial-Final projection is deliberately ineligible; never send it to the model.
  const input = presentationInput(state.sessionId, test.partial ? { ...cue, text: 'A 是 X。' } : cue,
    state.evidenceOrder.map(id => state.evidence[id]!));
  return { input, current: state.attention.currentCueId === cue.id };
}
export function getCase(id: unknown) {
  const value = cases.find(c => c.id === id);
  if (!value) throw new Error('Unknown Presentation case.');
  return value;
}
export default function tests() {
  return cases.map(c => ({ description: c.id, vars: { caseId: c.id }, metadata: {
    sourceKind: c.sourceKind, use: c.use, family: c.family, path: c.path,
    semanticGrade: 'UNSCORED', humanReview: 'NOT_RUN', review: c.review,
  } }));
}
